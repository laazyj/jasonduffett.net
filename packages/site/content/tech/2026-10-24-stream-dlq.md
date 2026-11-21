---
title: "The batch you can't afford to lose"
date: 2026-10-24
project: composurecdk-stream-dlq
summary: "Placeholder. An introduction to composurecdk-stream-dlq, which captures failed Lambda stream batches before the retention window closes."
tags:
  - aws
  - composure-labs
---

_Placeholder article for the design phase. The real introduction lands when the package is at or close to 1.0._

A Lambda consuming DynamoDB Streams eventually exhausts its retries on some batch. The records only live for the stream's retention window, so the failed batch has to be captured somewhere durable before that window closes, and the on-call has to hear about it with hours to spare.

## Capture, then signal

The package adds an S3 bucket for the event source mapping's on-failure destination, holding the full failed batch, and an SQS signal queue fed from the bucket through EventBridge. The queue gives you a native one-minute depth gauge to alarm on.

```ts
import { compose } from "@composurecdk/core";
import { createStreamDlqCapture } from "@composure-labs/composurecdk-stream-dlq";

export const system = compose({
  capture: createStreamDlqCapture(),
});
```

Capture is a composed system you add to your own `compose` map, in the same stack as its processor. It's a graph leaf: it never references the processor.

### What recovery will look like

A manual-only replay function is still to come, along with a least-privilege grant for plugging in your own recovery.

---

The rest of this article would cover the alarm thresholds and a worked failure. It is here to give the page some length, so that you can judge the measure, the headings and how the end of the page resolves.
