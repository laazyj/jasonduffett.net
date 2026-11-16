import { type Stack } from "aws-cdk-lib";

import { outputs } from "@composurecdk/cloudformation";
import { at, compose, ref } from "@composurecdk/core";
import {
  createRoleBuilder,
  createStatementBuilder,
  githubActions,
  type RoleBuilderResult,
} from "@composurecdk/iam";

export interface CiOidcOptions {
  readonly githubOwner: string;
  readonly githubRepo: string;
  readonly cdkBootstrapQualifier?: string;
}

const DEFAULT_CDK_QUALIFIER = "hnb659fds";

export function addCiOidc(stack: Stack, options: CiOidcOptions): void {
  const qualifier = options.cdkBootstrapQualifier ?? DEFAULT_CDK_QUALIFIER;

  // Don't rename this id: it would replace the account-singleton OIDC provider.
  const { provider } = githubActions.provider().build(stack, "GithubOidcProvider");

  // Subject-claim allowlist scopes role assumption to this exact repo. Forks
  // run workflows under their own `repo:<fork>/<name>:*` namespace, so they
  // cannot mint a token that satisfies these conditions even though the OIDC
  // provider is account-wide.
  const principal = githubActions.principal({
    owner: options.githubOwner,
    repo: options.githubRepo,
    provider,
    subjects: [githubActions.Subject.branch("main"), githubActions.Subject.pullRequest()],
  });

  // The role's only direct permission is to assume CDK's bootstrap roles in
  // any region of this account. Those roles are the actual permission boundary
  // for deploys; this design matches CDK's intended OIDC pattern and keeps the
  // long-lived role's blast radius limited to "do CDK things".
  //
  // `at()` pins the role's construct id, so its logical ID matches a
  // standalone build rather than gaining a `compose()` prefix. The role has a
  // fixed physical name, so a logical-ID change would fail the deploy.
  compose(
    {
      role: at(
        "GitHubActionsDeployRole",
        createRoleBuilder()
          .roleName("GitHubActionsDeployRole")
          .assumedBy(principal)
          .description(
            `GitHub Actions deploy role for ${options.githubOwner}/${options.githubRepo}.`,
          )
          .addInlinePolicyStatements("AssumeCdkBootstrapRoles", [
            createStatementBuilder()
              .allow()
              .actions(["sts:AssumeRole"])
              .resources([
                `arn:aws:iam::*:role/cdk-${qualifier}-deploy-role-*`,
                `arn:aws:iam::*:role/cdk-${qualifier}-file-publishing-role-*`,
                `arn:aws:iam::*:role/cdk-${qualifier}-image-publishing-role-*`,
                `arn:aws:iam::*:role/cdk-${qualifier}-lookup-role-*`,
              ]),
          ]),
      ),
    },
    { role: [] },
  )
    .afterBuild(
      outputs({
        GitHubActionsDeployRoleArn: {
          value: ref<RoleBuilderResult>("role")
            .get("role")
            .map((r) => r.roleArn),
          description: "Set as the GitHub Actions secret `AWS_DEPLOY_ROLE_ARN`.",
        },
      }),
    )
    .build(stack, "CiOidc");
}
