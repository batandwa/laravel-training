import * as cdk from 'aws-cdk-lib';
import { IpAddressType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster, Compatibility, ContainerImage, FargateService, Protocol, TaskDefinition } from 'aws-cdk-lib/aws-ecs';
import { LoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancing';
import { ApplicationLoadBalancer, ApplicationTargetGroup, ListenerAction, ListenerCondition } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { EcsFargateLaunchTarget } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Role, ServicePrincipal, ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class DeployStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = Vpc.fromLookup(this, "VPC", {
      vpcId: process.env.VPC_ID
    });

    const cluster = new Cluster(this, "APICluster", {
      clusterName: "api",
      vpc
    });

    const executionRole = new Role(this, 'TaskExecutionRole', {
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    const taskDef = new TaskDefinition(this, "TaskDef", {
      family: "api",
      cpu: "512",
      memoryMiB: "1024",
      compatibility: Compatibility.FARGATE,
      executionRole: executionRole,
    });

    taskDef.addContainer("echo", {
      image: ContainerImage.fromRegistry(process.env.IMAGE_URL ?? ""),
      memoryLimitMiB: 512,
      portMappings: [{
        containerPort: 3000,
        protocol: Protocol.TCP,
      }]
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
