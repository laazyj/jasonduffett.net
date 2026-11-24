import { Duration, type Stack } from "aws-cdk-lib";
import { type ErrorResponse } from "aws-cdk-lib/aws-cloudfront";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { EmailSubscription } from "aws-cdk-lib/aws-sns-subscriptions";

import { type AfterBuildHook, ref } from "@composurecdk/core";
import { alarmActionsPolicy } from "@composurecdk/cloudwatch";
import { createTopicBuilder, type TopicBuilderResult } from "@composurecdk/sns";

/**
 * Pieces common to the apex `createSystem()` and every `createSubsite()`: both
 * build the same pair of alert topics, route alarms to them the same way, and
 * serve the same 404 page.
 */

/** The two alert topics each system builds, by component key. */
type AlertTopicKey = "usEast1Alerts" | "siteAlerts";

/**
 * An SNS topic that emails `alertEmail`. CloudWatch alarms can only target a
 * same-region topic, so each system builds one per region.
 *
 * The recommended SNS delivery-failure alarms are off: `routeAlarmActions`
 * sends every alarm in the topic's stack to the topic, so they would notify the
 * topic they monitor and a failing topic could not report itself
 * (`@composurecdk/sns` warns at synth if they are re-enabled that way).
 */
export const alertTopic = (displayName: string, alertEmail: string) =>
  createTopicBuilder()
    .displayName(displayName)
    .addSubscription("email", new EmailSubscription(alertEmail))
    .recommendedAlarms(false);

/** A stack output exposing an alert topic's ARN, for subscribing to it. */
export const topicArnOutput = (refName: AlertTopicKey, role: string) => ({
  value: ref<TopicBuilderResult>(refName)
    .get("topic")
    .map((t) => t.topicArn),
  description: `Subscribe here to receive ${role}.`,
  scope: refName,
});

/** The stacks whose alarms `routeAlarmActions` routes. */
export interface AlarmStacks {
  readonly usEast1AlertsStack: Stack;
  readonly certStack: Stack;
  readonly cdnAlarmsStack: Stack;
  readonly siteStack: Stack;
}

/**
 * An `afterBuild` hook sending every alarm to its region's alert topic: the
 * us-east-1 stacks to `usEast1Alerts`, the site stack to `siteAlerts`. It routes
 * by stack rather than by alarm, so alarms added later are covered too.
 */
export const routeAlarmActions =
  ({
    usEast1AlertsStack,
    certStack,
    cdnAlarmsStack,
    siteStack,
  }: AlarmStacks): AfterBuildHook<Record<AlertTopicKey, TopicBuilderResult>> =>
  (_scope, _id, results) => {
    const usEast1Action = new SnsAction(results.usEast1Alerts.topic);
    for (const stack of [usEast1AlertsStack, certStack, cdnAlarmsStack]) {
      alarmActionsPolicy(stack, { defaults: { alarmActions: [usEast1Action] } });
    }
    alarmActionsPolicy(siteStack, {
      defaults: { alarmActions: [new SnsAction(results.siteAlerts.topic)] },
    });
  };

/**
 * Serve `/404.html` with a 404 for a missing object. S3 behind OAC answers 403
 * for a key that does not exist, so both statuses map to the page.
 */
export const NOT_FOUND_ERROR_RESPONSES: ErrorResponse[] = [403, 404].map((httpStatus) => ({
  httpStatus,
  responseHttpStatus: 404,
  responsePagePath: "/404.html",
  ttl: Duration.seconds(60),
}));
