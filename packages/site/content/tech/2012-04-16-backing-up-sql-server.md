---
title: "Backing up all databases in Microsoft SQL Server"
date: 2012-04-16
summary: "I’m not a big fan of Maintenance Plans. I know they can work quite well, but I don’t like the UI and the way it hides the actual SQL being used."
originalUrl: "https://jasonduffett.net/post/21207067908/backing-up-sql-server"
originalId: "21207067908"
tags:
  - sql
---

I’m not a big fan of Maintenance Plans. I know they can work quite well, but I don’t like the UI and the way it hides the actual SQL being used.

Yesterday I set about writing a stored proc that can manage backups (full and transaction log) for all databases on a server. We source control (using the awesome [SQL Source Control](http://www.red-gate.com/products/sql-development/sql-source-control/) from Red Gate) this script in our **db_maintenance** database so the same script is easily maintained and deployed to all SQL servers.

I started out using a script from SQLTeam.com that I found [here](http://www.sqlteam.com/article/database-backup-script). It looked like a good start but having been written in 2002 needed some updating!

This is what I ended up with.

You can specify whether the database is included in full backups, included in transaction log backups and how many days to retain backups for each. By default it will backup all databases (excluding tempdb), and support transaction log backups on all databases with FULL or BULK_LOGGED recovery models. The default retention period is 7 days for both full and transaction log backups.

```sql
CREATE procedure [dbo].[upDBA_Backup_All_Databases]
                @Path  varchar(128) ,
                @Type  varchar(4)           -- Full / Log
as

/*
    Backup file format
        _Full_yyyymmdd_hhmmss.bak
        _Log_yyyymmdd_hhmmss.bak
*/

/*
    Usage example
        exec [upDBA_Backup_All_Databases] 'c:\SQLBackups', 'Full'
*/

/*
    Configuration table
        create table dbo.tbDatabase_Backup_Setting (
            Name                 varchar(128) primary key nonclustered ,
            BackupFlagFull       varchar(1) not null check (BackupFlagFull in ('Y','N')) ,
            BackupFlagLog        varchar(1) not null check (BackupFlagLog in ('Y','N')) ,
            RetentionDaysFull    SmallInt not null ,
            RetentionDaysLog     SmallInt not null
       )
*/

-- NOTE: These should be single backslash characters, I just put double to fix a problem with the syntax highlighter!
if (Right(@Path, 1) <> '\\') set @Path = @Path + '\\'
declare @sql varchar(1000)
set nocount on

/*** Include new databases with default settings **/
insert dbo.tbDatabase_Backup_Setting
(
                Name,
                BackupFlagFull,
                BackupFlagLog,
                RetentionDaysFull ,
                RetentionDaysLog
)
select
                S.name,
                'Y', -- Always full backup
                case when (S.name NOT IN ('master','model','msdb')
                                AND DATABASEPROPERTYEX(S.name, 'Recovery') IN ('FULL','BULK_LOGGED')) then
                                'Y'            else 'N' end, -- No txn log backup on master, model, msdb, tempdb or databases with recovery models not supporting it
                7,                            -- keep full backups for 7 days
                7                              -- keep log backups for 7 days
from
                master..sysdatabases S
                left outer join dbo.tbDatabase_Backup_Setting DBS on DBS.Name = S.Name
where
                -- Exclude temp dbs
                S.name not in ('tempdb', 'ReportServerTempDB') and
                -- Exclude existing, known databases
                DBS.Name is null
print 'Added ' + Cast(@@rowcount as varchar) + ' new databases to tbDatabase_Backup_Setting.'

/*** Remove any non-existant databases ***/
delete dbo.tbDatabase_Backup_Setting
where not exists
(
                select name
                from master..sysdatabases
                where master..sysdatabases.Name = dbo.tbDatabase_Backup_Setting.Name
)
print 'Removed ' + Cast(@@rowcount as varchar) + ' old databases from tbDatabase_Backup_Setting.'



-- Tables for output from xp_cmdshell
create table #ExistingBackups (Name varchar(128), ID int identity (1,1))
create table #output ([message] varchar(128))
declare
                @Name                                                               varchar(128),
                @RetentionDays                              SmallInt,
                @LastBackupToKeep     varchar(8),
                @filename                                          varchar(512),
                @error                                                 varchar(max)

/*** Get databases and retention period for backups ***/
declare db_cursor cursor for
                select
                                Name,
                                case when @Type = 'Full' then RetentionDaysFull else RetentionDaysLog end
                from dbo.tbDatabase_Backup_Setting
                where
                                (@Type = 'Full' and BackupFlagFull = 'Y') or
                                (@Type = 'Log' and BackupFlagLog = 'Y')

/*** Loop through each database ***/
begin try
                open db_cursor
                fetch next from db_cursor INTO @Name, @RetentionDays

                while @@FETCH_STATUS = 0
                begin
                                /*** Backup the database ***/
                                select @filename = @Path + @Name + '_' + @Type + '_'
                                                                + convert(varchar(8),getdate(),112) + '_'
                                                                + replace(convert(varchar(8),getdate(),108),':','') + '.bak'
                                print 'Backing up [' + @Name + '] to ''' + @filename + ''''
                                if @Type = 'Full'
                                                backup database @Name to disk = @filename
                                else
                                                backup log @Name to disk = @filename

                                /*** Clean up existing backups ***/
                                select @sql = 'dir /B ' + @Path
                                select @sql = @sql + @Name + '_' + @Type + '*.*'
                                delete #ExistingBackups

                                insert #ExistingBackups exec master..xp_cmdshell @sql
                                delete #ExistingBackups where Name is null
                                if exists (select * from #ExistingBackups where Name like '%File Not Found%')
                                                delete #ExistingBackups

                                select @LastBackupToKeep = convert(varchar(8),DateAdd(dd, 0 - @RetentionDays, GetDate()), 112)
                                delete #ExistingBackups where Name > @Name + '_' + @Type + '_' + @LastBackupToKeep
                                print 'Keeping ' + cast(@@rowcount as varchar) + ' existing backups within retention period of ' + Cast(@RetentionDays as varchar) + ' days.'

                                declare @eID int, @eMaxID int
                                -- loop round all the out of date backups
                                select @eID = 0, @eMaxID = coalesce(max(ID), 0) from #ExistingBackups
                                while @eID < @eMaxID
                                begin
                                                select @eID = min(ID) from #ExistingBackups where ID > @eID
                                                select @filename = @Path + Name from #ExistingBackups where ID = @eID
                                                select @sql = 'del ' + @filename
                                                print 'Deleting ''' + @filename + ''''
                                                insert #output exec master..xp_cmdshell @sql
                                                if (select count(*) from #output where [message] is not null) > 0
                                                begin
                                                                set @error = ''
                                                                select @error = @error + ' [' + [message] + ']' from #output where [message] is not null
                                                                raiserror ('An error occurred deleting old backup file: ''%s''.', 16, 1, @error)
                                                end
                                                delete #output
                                end
                                delete   #ExistingBackups

                                -- Fetch next database
                                fetch next from db_cursor INTO @Name, @RetentionDays
                end
end try
begin catch
                -- Error reporting via RAISERROR
                declare @ErrorNumber    INT            = ERROR_NUMBER()
                declare @ErrorMessage   NVARCHAR(4000) = ERROR_MESSAGE()
                declare @ErrorProcedure NVARCHAR(4000) = ERROR_PROCEDURE()
                declare @ErrorLine      INT            = ERROR_LINE()

                RAISERROR ('An error occurred during database backup.
                                                                Error Number        : %d
                                                                Error Message       : %s
                                                                Database Name       : %s
                                                                Affected Procedure  : %s
                                                                Affected Line Number: %d',
                                                                16, 1,
                                                                @ErrorNumber, @ErrorMessage, @Name, @ErrorProcedure,@ErrorLine)
end catch

-- Ensure cursor is closed
if CURSOR_STATUS('global','db_cursor') >= 0
begin
                close db_cursor
                deallocate db_cursor
end

GO
```
