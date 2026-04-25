---
title: "I'm sure this wasn't Ayende's intention..."
date: 2012-05-10
summary: "Now that I know C# has a GOTO statement…"
originalUrl: "https://jasonduffett.net/post/22776750839/apple-basic-in-csharp"
originalId: "22776750839"
---

[I'm sure this wasn't Ayende's intention...](http://ayende.com/blog/155073/reviewing-xenta-and-wishing-i-hadnrsquo-t)

But now that I know C# has a GOTO statement I can bang out this classic from my Apple II days…

```csharp
using System;
namespace ConsoleApplication1
{
    class Program
    {
        static void Main(string[] args)
        {
            ten:
            print("hello world");
            twenty:
            goto ten;
        }
        static void print(string msg)
        {
            Console.WriteLine(msg);
        }
    }
}
```
