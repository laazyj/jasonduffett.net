---
title: "A guide to value object equality in .NET (part 2)"
date: 2011-05-09
summary: "In the 2nd part of the series I’ll explain the GetHashCode() method and how you should implement this in your value-type classes."
originalUrl: "https://jasonduffett.net/post/5330529943/guide-to-value-object-equality-part-2"
originalId: "5330529943"
tags:
  - net
  - object-equality-guide
  - domain-driven-design
---

In the 2nd part of [the series](http://jasonduffett.net/tagged/Object%20Equality%20Guide) I’ll explain the GetHashCode() method and how you should implement this in your value-type classes.

_[Part 1](http://jasonduffett.net/post/5220416027/guide-to-value-object-equality-part-1) of the series shows how to correctly implement Equals, and the ==/!= operators._

Continuing our work on the EmailAddress class, we have so far implemented an immutable class that compares to other instances of the same type or to strings in the format “display name <email address>”…

```csharp
public class EmailAddress
{
    public EmailAddress(string displayName, string address)
	{
	    DisplayName = displayName;
		Address = address;
    }

	public string Address { get; private set; }
	public string DisplayName { get; private set; }

	public override string ToString()
	{
	    return String.IsNullOrWhiteSpace(DisplayName)
		    ? Address
			: String.Format("{0} <{1}>", DisplayName, Address);
	}

	public bool Equals(EmailAddress other)
	{
	    if (ReferenceEquals(null, other)) return false;
		if (ReferenceEquals(this, other)) return true;
		return other.DisplayName == DisplayName &&
		    other.Address == Address;
	}

	public bool Equals(string emailNameAndAddress)
	{
	    if (ReferenceEquals(null, emailNameAndAddress)) return false;
		return emailNameAndAddress == ToString();
	}

	public override bool Equals(object obj)
	{
	    if (obj is string) return Equals((string)obj);
		return base.Equals(obj as EmailAddress);
	}

	public override int GetHashCode()
	{
	    // TODO: What do I do with GetHashCode?
		return base.GetHashCode();
	}

	public static bool operator ==(EmailAddress emailAddress1, EmailAddress emailAddress2)
	{
	    if (ReferenceEquals(emailAddress1, null)) return false;
		return emailAddress1.Equals(emailAddress2);
	}

	public static bool operator !=(EmailAddress emailAddress1, EmailAddress emailAddress2)
	{
	    if (ReferenceEquals(emailAddress1, null)) return true;
		return !emailAddress1.Equals(emailAddress2);
	}

	public static bool operator ==(EmailAddress emailAddress, string nameAndAddress)
	{
	    if (ReferenceEquals(emailAddress, null)) return false;
		return emailAddress.Equals(nameAndAddress);
	}

	public static bool operator !=(EmailAddress emailAddress, string nameAndAddress)
	{
	    if (ReferenceEquals(emailAddress, null)) return true;
		return !emailAddress.Equals(nameAndAddress);
	}
}
```

### Just what do I do with GetHashCode()?

The requirements for GetHashCode() are best described by [Mark Gravell in this StackOverflow answer](http://stackoverflow.com/questions/371328/why-is-it-important-to-override-gethashcode-when-equals-method-is-overriden-in-c/371348#371348):

- if two things are equal (Equals(…) == true) then they must return the same value for GetHashCode()
- if the GetHashCode() is equal, it is not necessary for them to be the same; this is a collision, and Equals will be called to see if it is a real equality or not.

I also found a good [demonstration of what happens if you don’t provide a correct GetHashCode() implementation (again on StackOverflow)](http://stackoverflow.com/questions/638761/c-gethashcode-override-of-object-containing-generic-array/639098#639098). In the demonstration it shows that HashSet wouldn’t consider the two instances as equal and ends up adding them both to the set. This might seem like a small problem in the demonstration but it is incorrect behaviour for an immutable value type and would be frustrating and difficult to debug if it got into a large-scale application.

There seemed to be quite a few different ways of implementing GetHashCode, a lot of them by people who didn’t seem to really understand the requirements. After looking around, it seemed to me that the bst way of implementing it is [described here](http://stackoverflow.com/questions/1008633/gethashcode-problem-using-xor/1008666#1008666). You take two [co-prime numbers](http://en.wikipedia.org/wiki/Coprime) (See [http://wiki.answers.com/Q/List_of_co_prime_numbers_in_between_1_to_31](http://wiki.answers.com/Q/List_of_co_prime_numbers_in_between_1_to_31) for some example sets of coprimes), and use these to compute a hash in the following way:

```csharp
var hash = 13
hash = (hash *7) + MyFieldValue1;
hash = (hash * 7) + MyFieldValue2;
if (MyReferenceTypeField != null)
    hash = (hash * 7) + MyReferenceTypeField.GetHashCode();
return hash;
```

You should also setup some tests to prove that two instances that are equal have the same hash code…

```csharp
[Subject(“Equality test”)]
public class when_an_instance_is_equal_to_another
    It should_return_true_for_equals = () =>
        (SUT.Equals(new MyValueClass(SUT.Field1, SUT.Field2)).ShouldBeTrue();

    It should_have_the_same_hashcode = () =>
        (SUT.GetHashCode() == new MyValueClass (SUT.Field1, SUT.Field2).GetHashCode()).ShouldBeTrue();

    […]
}
```

Given that equality of our **EmailAddress** is based on the **DisplayName** and **Address** fields, the correct implementation is:

```csharp
public override int GetHashCode()
{
    var hash = 23;
    hash = (hash * 37) + DisplayName.GetHashCode();
    hash = (hash * 37) + Address.GetHashCode();
    return hash;
}
```
