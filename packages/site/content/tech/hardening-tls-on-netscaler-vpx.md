---
title: "Hardening TLS on NetScaler VPX, revisited"
date: 2026-04-02
summary: "The note I wish I'd written last time."
---

Every few years I end up back in the NetScaler console, staring at the same cipher-suite dialog and trying to remember which knobs actually matter. This is the note I wish I'd written last time.

The goal is simple: an **A+** on SSL Labs, without locking out the two or three clients that still matter to the business. Everything below assumes VPX 14.x with the default front-end vserver.

## Start from a known baseline

Before changing anything, capture the current profile. It makes rollback a one-liner and gives you something to diff against later:

```bash
show ssl vserver vs_www_443 | grep -i cipher
show ssl profile ns_default_ssl_profile_frontend
```

> If you skip this step you _will_ regret it the first time a partner calls to say their integration stopped working at 3 a.m.

## The cipher group I actually ship

After some back-and-forth with SSL Labs I settled on a small, explicit group rather than one of the built-in bundles. TLS 1.3 first, then a short TLS 1.2 tail for legacy callers:

```bash
add ssl cipher cg_2026_modern
bind ssl cipher cg_2026_modern -cipherName TLS1.3-AES256-GCM-SHA384 -cipherPriority 1
bind ssl cipher cg_2026_modern -cipherName TLS1.3-AES128-GCM-SHA256 -cipherPriority 2
bind ssl cipher cg_2026_modern -cipherName TLS1.2-ECDHE-RSA-AES256-GCM-SHA384 -cipherPriority 3
```

Bind it to the vserver, re-run [SSL Labs](https://www.ssllabs.com/ssltest/), and you should be done. If you aren't, the next section is the usual culprit.

---

_Next post: a ukulele arrangement of Wichita Lineman — because balance._
