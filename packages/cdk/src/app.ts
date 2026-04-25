import { App, Fn, Stack } from "aws-cdk-lib";

import { compose, ref } from "@composurecdk/core";
import { outputs } from "@composurecdk/cloudformation";
import { createHostedZoneBuilder, type HostedZoneBuilderResult } from "@composurecdk/route53";
import { zoneRecords } from "@composurecdk/route53/zone";

import { DOMAIN, ZONE_RECORDS } from "./zone-records.js";

const app = new App();

const dnsStack = new Stack(app, "JasonDuffettNetDnsStack", {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "eu-west-2" },
  description: "DNS for jasonduffett.net (Route 53 hosted zone + records).",
});

const hostedZone = ref<HostedZoneBuilderResult>("zone").get("hostedZone");

compose(
  {
    zone: createHostedZoneBuilder().zoneName(DOMAIN),
    records: zoneRecords(ZONE_RECORDS).zone(hostedZone),
  },
  { zone: [], records: ["zone"] },
)
  .afterBuild(
    outputs({
      NameServers: {
        value: hostedZone.map((z) => Fn.join(",", z.hostedZoneNameServers ?? [])),
        description: "Set these as the NS records at the domain registrar to delegate the zone.",
        scope: "zone",
      },
    }),
  )
  .build(dnsStack, "DNS");

app.synth();
