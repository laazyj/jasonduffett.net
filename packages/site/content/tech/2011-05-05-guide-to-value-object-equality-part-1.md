---
title: "A guide to value object equality in .NET (Part 1)"
date: 2011-05-05
summary: "This is a guide to providing equality functionality to Value type classes in .NET. These are complex, immutable classes that behave like a value type."
originalUrl: "https://jasonduffett.net/post/5220416027/guide-to-value-object-equality-part-1"
originalId: "5220416027"
tags:
  - net
  - object-equality-guide
  - domain-driven-design
---

This is a guide to providing equality functionality to Value type classes in .NET. These are complex, immutable classes that behave like a value type.

Implementing complex business primitives as value types is a core part of [Domain Driven Design](http://domaindrivendesign.org/resources/what_is_ddd) and creates a rich domain model and language that closely represents your actual business processes. For instance Money (Decimal value + Currency), Price (Ex-tax amount + sales tax amount).

In this example I’ll use an **EmailAddress** which we’ll define as the Address [string], and an optional Display Name [string].

```csharp
public class EmailAddress
{
    private readonly string _displayName;
    private readonly string _address;

    public EmailAddress(string displayName, string address)
    {
        _displayName = displayName;
        _address = address;
    }

    public EmailAddress(string address)
    {
        _address = address;
    }

    public string DisplayName
    {
        get { return _displayName; }
    }

    public string Address
    {
        get { return _address; }
    }

    ///
    /// Provide the standard string representation of a display name + email address.
    ///
    override public ToString()
    {
        return _displayName == null
            ? _address
            : String.Format("{0} <{1}>", _displayName, _address);
    }
}
```

The important attributes of a value type are:

1. It is immutable.
2. Two different instances of the type are equal if they represent the same value.

The core thing that we’re trying to achieve when implementing equality functionality for value objects is to have any equality comparisons (==, !=, .Equals(…), etc) follow the semantics of the value type. By default CLR classes derived from the System.Object type always perform reference equality – that is 2 instances of a class are not equal, even if all the properties of the class are equal – our aim is reverse this. Unfortunately, it’s very easy to make a mess of code doing this, run into infinite recursion, code duplication and other rubbish. Here is how I’m going about it with the EmailAddress class…

1. <strong>Start with tests!</strong> Tackling this problem test-first is a no-brainer. It allows you to clarify your ideas of what comparisons should be equal, and what shouldn’t be.
2. <strong>Implement a custom version of Equals</strong> The first thing to do is make the comparison with objects of the same type work. Don’t start by overriding <strong>Object.Equals(object)</strong>, start by creating a method for your specific type. In the case of EmailAddress this is:

```csharp
public bool Equals(EmailAddress other)
{
    if (ReferenceEquals(null, other)) return false;
    if (ReferenceEquals(this, other)) return true;
    return other.DisplayName == DisplayName
       && other.Address == Address;
}
```

Simple. It checks if “other” is null. It checks if “other” is the same reference as “this”. Then it does the custom property comparison required for this type (compares Address and DisplayName). 3. <strong>Use ReferenceEquals() not ==</strong> This is where you can get stuck in a recursive loop. Eventually we’ll be overriding the == operator to use our Equals() method. If Equals() used == which used Equals() which used ==…. And so on.. we have a problem. ReferenceEquals solves this. 4. <strong>Check for null and the same instance first</strong> Duh. 5. <strong>Now override Equals(object)</strong> Check for null, check for the same reference, then call your custom Equals method, use the “as” keyword to cast the object as the type you expect – if it’s not of the correct type then the cast will produce null to which our Equals method returns false.

```csharp
return Equals(obj as EmailAddress);
```

6. <strong>Override GetHashCode()</strong> This is a more complex topic that I’ll cover in a later post… For now let’s just return base.GetHashCode() - which is bad but will work for our purposes now.
7. <strong>Override the == and != operators</strong> Keep it simple. Check for null then defer to our Equals() method.

```csharp
public static bool operator ==(EmailAddress emailAddress1, EmailAddress emailAddress2)
{
    if (ReferenceEquals(emailAddress1, null)) return false;
    return emailAddress1.Equals(emailAddress2);
}
```

8. <strong>Now start adding complexity if you need it.</strong> With this in place you can start adding extra complexity, but remember DRY! For instance to add string comparison to the string representation of an EmailAddress (<em>Display Name <emailaddress></em>) we would do the following: <ul><li>Add an Equals(string emailAddressString) method which includes the comparison logic.

```csharp
if (obj is string) return Equals((string)obj);
```

9. Add the ==/!= operators – check for null and defer to our custom method.

Follow these steps and adding value-type comparison functionality to your class should be easy!!
