import * as cdk from 'aws-cdk-lib';
import { Cluster } from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class DeployStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new Cluster(this, "APICluster", {
      clusterName: "api",
    });

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'DeployQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
