---
title: "A guide to value object equality in .NET (part 3)"
date: 2011-05-08
series: value-object-equality
seriesPart: 3
summary: "In the 3rd part of this series I’ll show the tests I used to define, and confirm, my assumptions on how comparison of the EmailAddress object should work."
originalUrl: "https://jasonduffett.net/post/5304097697/guide-to-value-object-equality-part-3"
originalId: "5304097697"
tags:
  - net
  - ddd
  - obje
  - object-equality-guide
---

In the 3rd part of [this series]({{ '/tech/guide-to-value-object-equality-part-1/' | rel }}) I’ll show the tests I used to define, and confirm, my assumptions on how comparison of the EmailAddress object should work.

If you didn’t catch the [other instalments in this series]({{ '/tech/guide-to-value-object-equality-part-1/' | rel }}):

- In [part 1](http://jasonduffett.net/post/5220416027/guide-to-value-object-equality-part-1) I explained how comparisons should work for value-type objects and implemented Equals and the ==/!= operators.
- In part 2 I covered GetHashCode() - why you can’t just use base.GetHashCode().

My current favourite .NET testing framework is the excellent [Machine.Specifications](https://github.com/machine/machine.specifications#readme) (a.k.a. MSpec). If you’re not familiar with this framework than I highly recommend it and the BDD style syntax that it encourages.

```powershell
using eSpares.Levity.Model.Primitives;
using Machine.Specifications;

namespace eSpares.Levity.Model.Specs.Primitives
{
	public abstract class EmailAddressComparisonContext
	{
		private const string TestName = "my name";
		private const string TestEmail = "my@address.com";

		Establish context = () =>
			SUT = new EmailAddress(TestName, TestEmail);

		protected static EmailAddress SUT { get; private set; }
	}

	[Subject("EmailAddress Equality")]
	public class when_comparing_equality_of_email_address_to_another_email_address : EmailAddressComparisonContext
	{
		It should_not_be_equal_to_null = () =>
			(SUT == (EmailAddress)null).ShouldBeFalse();

		It should_equal_itself = () =>
			(SUT == SUT).ShouldBeTrue();

		It should_equal_an_email_address_with_the_same_name_and_address = () =>
			(SUT == new EmailAddress(SUT.Name, SUT.Address)).ShouldBeTrue();

		It should_have_the_same_hashcode_as_an_email_address_with_the_same_name_and_address = () =>
			(SUT.GetHashCode() == new EmailAddress(SUT.Name, SUT.Address).GetHashCode()).ShouldBeTrue();

		It should_not_equal_an_email_address_with_different_name = () =>
			(SUT == new EmailAddress("a different name", SUT.Address)).ShouldBeFalse();

		It should_not_equal_an_email_address_with_different_address = () =>
			(SUT == new EmailAddress(SUT.Name, "some other address")).ShouldBeFalse();

		It should_equal_an_email_address_with_the_same_string_value = () =>
			(SUT == new EmailAddress(SUT.ToString())).ShouldBeTrue();
	}

	[Subject("EmailAddress Equality")]
	public class when_comparing_equality_of_email_address_using_equals : EmailAddressComparisonContext
	{
		It should_not_be_equal_to_null = () =>
			SUT.Equals((EmailAddress)null).ShouldBeFalse();

		It should_equal_itself = () =>
			SUT.Equals(SUT).ShouldBeTrue();

		It should_equal_an_email_address_with_the_same_name_and_address = () =>
			SUT.Equals(new EmailAddress(SUT.Name, SUT.Address)).ShouldBeTrue();

		It should_not_equal_an_email_address_with_different_name = () =>
			SUT.Equals(new EmailAddress("another name", SUT.Address)).ShouldBeFalse();

		It should_not_equal_an_email_address_with_different_address = () =>
			SUT.Equals(new EmailAddress(SUT.Name, "not_my_address")).ShouldBeFalse();

		It should_equal_a_string_matching_its_string_value = () =>
			SUT.Equals(SUT.ToString()).ShouldBeTrue();

		It should_not_equal_a_string_that_doesnt_match_its_string_value = () =>
			SUT.Equals("a different string").ShouldBeFalse();
	}

	[Subject("EmailAddress Equality")]
	public class when_comparing_inequality_of_email_address_to_another_email_address : EmailAddressComparisonContext
	{
		It should_not_be_equal_to_null = () =>
			(SUT != (EmailAddress)null).ShouldBeTrue();

		It should_equal_itself = () =>
			(SUT != SUT).ShouldBeFalse();

		It should_equal_an_email_address_with_the_same_name_and_address = () =>
			(SUT != new EmailAddress(SUT.Name, SUT.Address)).ShouldBeFalse();

		It should_not_equal_an_email_address_with_different_name = () =>
			(SUT != new EmailAddress("not my name", SUT.Address)).ShouldBeTrue();

		It should_not_equal_an_email_address_with_different_address = () =>
			(SUT != new EmailAddress(SUT.Name, "not my address")).ShouldBeTrue();
	}

	[Subject("EmailAddress Equality")]
	public class when_comparing_equality_of_email_address_to_a_string : EmailAddressComparisonContext
	{
		It should_equal_a_value_matching_its_string_value = () =>
			(SUT == SUT.ToString()).ShouldBeTrue();

		It should_not_equal_a_value_that_doesnt_match_its_string_value = () =>
			(SUT == "this is not me").ShouldBeFalse();
	}

	[Subject("EmailAddress Equality")]
	public class when_comparing_inequality_of_email_address_to_a_string : EmailAddressComparisonContext
	{
		It should_equal_a_value_matching_its_string_value = () =>
			(SUT != SUT.ToString()).ShouldBeFalse();

		It should_not_equal_a_value_that_doesnt_match_its_string_value = () =>
			(SUT != "nope").ShouldBeTrue();
	}
}
```

Finally.. let’s just add some candy to the implementation to make it easier to use…

```powershell
using System;
using eSpares.Levity.Model.Primitives;
using Machine.Specifications;

namespace eSpares.Levity.Model.Specs.Primitives
{
	[Subject("EmailAddress Construction")]
	public class When_creating_primitive_from_a_valid_email_address_string
	{
		private const string valid_email_address = "valid@email.address.com";

		It should_set_the_address_property_to_the_email_address = () =>
			email.Address.ShouldEqual(valid_email_address);

		It should_set_the_name_property_to_null = () =>
			email.Name.ShouldEqual(null);

		Because of = () =>
			email = new EmailAddress(valid_email_address);

		static EmailAddress email;
	}

	[Subject("EmailAddress Construction")]
	public class When_creating_primitive_from_a_valid_name_and_email_address_string
	{
		private const string valid_name_and_email_address = "My Name ";
		private const string Name = "My Name";
		private const string Address = "valid@email.address.com";

		It should_set_the_address_property_to_the_email_address = () =>
			email.Address.ShouldEqual(Address);

		It should_set_the_name_property_to_the_name = () =>
			email.Name.ShouldEqual(Name);

		Because of = () =>
			email = new EmailAddress(valid_name_and_email_address);

		static EmailAddress email;
	}

	[Subject("EmailAddress Construction")]
	public class When_creating_primitive_from_string_ending_with_opening_angle_bracket
	{
		private const string invalid_name_and_email_address = "My Name <";

		It should_set_the_address_property_to_the_string = () =>
			email.Address.ShouldEqual(invalid_name_and_email_address);

		It should_not_set_the_name_property = () =>
			email.Name.ShouldEqual(null);

		Because of = () =>
			email = new EmailAddress(invalid_name_and_email_address);

		static EmailAddress email;
	}

	[Subject("EmailAddress Construction")]
	public class When_creating_primitive_from_string_without_closing_angle_bracket
	{
		private const string invalid_name_and_email_address = "My Name
			email.Address.ShouldEqual(invalid_name_and_email_address);

		It should_not_set_the_name_property = () =>
			email.Name.ShouldEqual(null);

		Because of = () =>
			email = new EmailAddress(invalid_name_and_email_address);

		static EmailAddress email;
	}

	[Subject("EmailAddress Construction")]
	public class When_creating_primitive_from_string_without_opening_angle_bracket
	{
		private const string invalid_name_and_email_address = "My Name >nothing interesting";

		It should_set_the_address_property_to_the_string = () =>
			email.Address.ShouldEqual(invalid_name_and_email_address);

		It should_not_set_the_name_property = () =>
			email.Name.ShouldEqual(null);

		Because of = () =>
			email = new EmailAddress(invalid_name_and_email_address);

		static EmailAddress email;
	}

	[Subject("EmailAddress Construction")]
	public class When_creating_primitive_from_string_with_empty_angle_brackets
	{
		private const string invalid_name_and_email_address = "My Name <>";
		private const string name = "My Name";

		It should_set_the_address_property_to_an_empty_string = () =>
			email.Address.ShouldEqual(string.Empty);

		It should_set_the_name = () =>
			email.Name.ShouldEqual(name);

		Because of = () =>
			email = new EmailAddress(invalid_name_and_email_address);

		static EmailAddress email;
	}

	[Subject("EmailAddress Construction")]
	public class When_creating_primitive_from_invalid_string
	{
		private const string invalid_name_and_email_address = "just something or other";

		It should_set_the_address_property_to_the_string = () =>
			email.Address.ShouldEqual(invalid_name_and_email_address);

		It should_not_set_the_name_property = () =>
			email.Name.ShouldEqual(null);

		Because of = () =>
			email = new EmailAddress(invalid_name_and_email_address);

		static EmailAddress email;
	}

	[Subject("EmailAddress Primitive")]
	public class When_using_email_address_as_a_string
	{
		private const string name = "My Name";
		private const string address = "email@address.com";

		It should_return_the_name_and_address_in_standard_name_address_format = () =>
			email.ToString().ShouldEqual(String.Format("{0} <{1}>", name, address));

		Because of = () =>
			email = new EmailAddress(name, address);

		static EmailAddress email;
	}

	[Subject("EmailAddress Primitive")]
	public class When_email_address_has_no_name
	{
		private const string address = "my@email.address";

		It should_return_a_string_value_of_just_the_address = () =>
			email.ToString().ShouldEqual(address);

		Because of = () =>
			email = new EmailAddress(null, address);

		static EmailAddress email;
	}

	[Subject("EmailAddress Construction")]
	public class When_creating_email_address_using_a_name_containing_angle_brackets
	{
		private const string invalid_name = "My < Name";
		private const string address = "email@address.com";

		It should_throw_a_format_exception = () =>
			Exception.ShouldBeOfType(typeof(FormatException));

		Because of = () =>
			Exception = Catch.Exception(() => new EmailAddress(invalid_name, address));

		static Exception Exception;
	}

	[Subject("EmailAddress Construction")]
	public class When_creating_email_address_using_an_address_containing_angle_brackets
	{
		private const string invalid_address = ">not@an.email";
		private const string name = "name";

		It should_throw_a_format_exception = () =>
			Exception.ShouldBeOfType(typeof(FormatException));

		Because of = () =>
			Exception = Catch.Exception(() => new EmailAddress(name, invalid_address));

		static Exception Exception;
	}

	[Subject("EmailAddress Construction")]
	public class When_creating_email_address_without_specifying_an_address
	{
		private const string invalid_address = "      ";
		private const string name = "name";

		It should_throw_a_format_exception = () =>
			Exception.ShouldBeOfType(typeof(FormatException));

		Because of = () =>
			Exception = Catch.Exception(() => new EmailAddress(name, invalid_address));

		static Exception Exception;
	}
}
```

```csharp
using System;

namespace eSpares.Levity.Model.Primitives
{
	public class EmailAddress
	{
		private static readonly char[] InvalidNameChars = new[] { '<', '>' };
		private static readonly char[] InvalidAddressChars = new[] { '<', '>' };

		public EmailAddress(string nameAndEmailAddress)
		{
			Name = parseNameFromNameAndAddress(nameAndEmailAddress);
			Address = parseAddressFromNameAndAddress(nameAndEmailAddress);
		}

		public EmailAddress(string name, string address)
		{
			Guard.Against(!isNameValid(name), "Value is invalid for EmailAddress.Name: [{0}]", name);
			Guard.Against(!isAddressValid(address), "Value is invalid for EmailAddress.Address: [{0}]", address);
			Name = name;
			Address = address;
		}

		public string Address { get; private set; }
		public string Name { get; private set; }

		public override string ToString()
		{
			return String.IsNullOrWhiteSpace(Name)
				? Address
				: String.Format("{0} <{1}>", Name, Address);
		}

		public bool Equals(EmailAddress other)
		{
			if (ReferenceEquals(null, other)) return false;
			if (ReferenceEquals(this, other)) return true;
			return other.Name == Name &&
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
			var hash = 23;
			hash = (hash * 37) + Name.GetHashCode();
			hash = (hash * 37) + Address.GetHashCode();
			return hash;
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

		private static bool isNameValid(string name)
		{
			return name == null || name.IndexOfAny(InvalidNameChars) < 0;
		}

		private static bool isAddressValid(string address)
		{
			if (address == null) return false;
			if (address.Trim().Length == 0) return false;
			if (address.IndexOfAny(InvalidAddressChars) >= 0) return false;

			return true;
		}

		///
		/// Returns the name portion of a string in format "Name <email>
		///
		private static string parseNameFromNameAndAddress(string nameAndEmailAddress)
		{
			var i = nameAndEmailAddress.IndexOf('<');
			return i >= 0 && nameAndEmailAddress.Contains(">")
			       	? nameAndEmailAddress.Substring(0, i).Trim()
			       	: null;
		}

		///
		/// Returns the address portion of a string in format "Name <email>
		///
		private static string parseAddressFromNameAndAddress(string nameAndEmailAddress)
		{
			var start = nameAndEmailAddress.IndexOf('<');
			var end = nameAndEmailAddress.IndexOf('>', start + 1);
			if (start < 0 || end < 0)
				return nameAndEmailAddress.Trim();

			return end >= 0
				? nameAndEmailAddress.Substring(start + 1, end - start - 1).Trim()
				: nameAndEmailAddress.Substring(start + 1);
		}
	}
}
```
