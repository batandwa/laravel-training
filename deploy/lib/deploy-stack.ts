import * as cdk from 'aws-cdk-lib';
import { IpAddressType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster, Compatibility, ContainerImage, FargateService, TaskDefinition } from 'aws-cdk-lib/aws-ecs';
import { LoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancing';
import { ApplicationLoadBalancer, ApplicationTargetGroup, ListenerAction, ListenerCondition } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { EcsFargateLaunchTarget } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class DeployStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = Vpc.fromLookup(this, "VPC", {
      vpcId: "vpc-052ef000932e819c2"
    });

    const cluster = new Cluster(this, "APICluster", {
      clusterName: "api",
      vpc
    });

    const taskDef = new TaskDefinition(this, "TaskDef", {
      family: "api",
      cpu: "512",
      memoryMiB: "1024",
      compatibility: Compatibility.FARGATE,
    });

    taskDef.addContainer("Echo", {
      image: ContainerImage.fromRegistry("ealen/echo-server:0.9.1"),
      memoryLimitMiB: 512,
    });

    const service = new FargateService(this, 'Service', {
      serviceName: "api",
      cluster,
      taskDefinition: taskDef,
      minHealthyPercent: 100,
    });

    const lb = new ApplicationLoadBalancer(this, "LB", {
      vpc,
      internetFacing: true,
      loadBalancerName: "external-api",
    });

    const listener = lb.addListener("ALBListener", {
      port: 80
    });

    listener.addAction("DefaultAction", {
      action: ListenerAction.fixedResponse(502, {
        // contentType: "application/json",
        messageBody: JSON.stringify({
          title: "Could not route this request",
          status: 502,
          detail: "Could not route this request"
        })
      })
    });

    const applicationTargetGroup = new ApplicationTargetGroup(this, "api", {
        port: 80,
        vpc,
        targets: [service]
      },
    );

    listener.addTargetGroups("rule", {
      conditions: [
        ListenerCondition.pathPatterns(["/events*"]),
      ],
      priority: 300,
      targetGroups: [applicationTargetGroup],
    });
  }
}
