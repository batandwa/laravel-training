import * as cdk from 'aws-cdk-lib';
import { IpAddressType, Vpc, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { Cluster, Compatibility, ContainerImage, FargateService, Protocol, TaskDefinition, Secret } from 'aws-cdk-lib/aws-ecs';
import { LoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancing';
import { ApplicationLoadBalancer, ApplicationTargetGroup, ListenerAction, ListenerCondition } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { EcsFargateLaunchTarget } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Role, ServicePrincipal, ManagedPolicy, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Secret as SecretsManagerSecret } from 'aws-cdk-lib/aws-secretsmanager';
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

    executionRole.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'ecr:GetAuthorizationToken',
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
      ],
      resources: ['*'],
    }));

    const taskDef = new TaskDefinition(this, "TaskDef", {
      family: "api",
      cpu: "512",
      memoryMiB: "1024",
      compatibility: Compatibility.FARGATE,
      executionRole: executionRole,
    });

    executionRole.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
      ],
      resources: [
        `arn:aws:secretsmanager:${this.region}:${this.account}:secret:api-db*`,
      ],
    }));

    taskDef.addContainer("api", {
      image: ContainerImage.fromRegistry(process.env.IMAGE_URL ?? ""),
      memoryLimitMiB: 512,
      portMappings: [{
        containerPort: 80,
        protocol: Protocol.TCP,
      }],
      secrets: {
        DB_HOST: Secret.fromSecretsManager(
          SecretsManagerSecret.fromSecretNameV2(this, 'DBHostSecret', 'api-db!host'),
          'host'
        ),
        DB_PORT: Secret.fromSecretsManager(
          SecretsManagerSecret.fromSecretNameV2(this, 'DBPortSecret', 'api-db!port'),
          'port'
        ),
        DB_DATABASE: Secret.fromSecretsManager(
          SecretsManagerSecret.fromSecretNameV2(this, 'DBDatabaseSecret', 'api-db!dbname'),
          'dbname'
        ),
        DB_USERNAME: Secret.fromSecretsManager(
          SecretsManagerSecret.fromSecretNameV2(this, 'DBUsernameSecret', 'api-db!username'),
          'username'
        ),
        DB_PASSWORD: Secret.fromSecretsManager(
          SecretsManagerSecret.fromSecretNameV2(this, 'DBPasswordSecret', 'api-db!password'),
          'password'
        ),
      },
    });


    const service = new FargateService(this, 'Service', {
      serviceName: "api",
      cluster,
      taskDefinition: taskDef,
      minHealthyPercent: 100,
      // Assign public IP to ensure the task can access ECR
      // assignPublicIp: true,
      // Explicitly use public subnets for internet access
      // vpcSubnets: {
      //   subnetType: SubnetType.PUBLIC
      // }
    });

    const lb = new ApplicationLoadBalancer(this, "LB", {
      vpc,
      internetFacing: true,
      loadBalancerName: "external-api",
      // Explicitly use public subnets for the ALB
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC
      }
    });

    const listener = lb.addListener("ALBListener", {
      port: 80,
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
        targets: [service],
        healthCheck: {
          path: '/up',
        },
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
