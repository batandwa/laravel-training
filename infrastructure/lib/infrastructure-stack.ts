import * as cdk from 'aws-cdk-lib';
import { Instance, InstanceClass, InstanceSize, InstanceType, Vpc, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { Repository, TagMutability } from 'aws-cdk-lib/aws-ecr';
import { ArnPrincipal, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { ClusterInstance, DatabaseCluster, DatabaseClusterEngine, DatabaseInstance, DatabaseInstanceEngine, MariaDbEngineVersion, MysqlEngineVersion, SubnetGroup, Credentials } from 'aws-cdk-lib/aws-rds';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { CfnResource, IAspect, RemovalPolicy } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';

class DestroyRemovalPolicyAspect implements IAspect {
  public visit(node: IConstruct): void {
    if (node instanceof CfnResource) {
      node.applyRemovalPolicy(RemovalPolicy.DESTROY);
    }
  }
}

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    cdk.Aspects.of(this).add(new DestroyRemovalPolicyAspect());

    const vpc = Vpc.fromLookup(this, "VPC", {
      vpcId: process.env.VPC_ID
    });

    const ecrRepo = new Repository(this, "Repo", {
      repositoryName: "api",
      imageTagMutability: TagMutability.IMMUTABLE,
    });


    const authorisationAccountsPermission = new PolicyStatement({
      sid: "Access to Repositories",
      effect: Effect.ALLOW,
      principals: [new ArnPrincipal(`arn:aws:iam::${process.env.ACCOUNT_ID}:root`)],
      actions: [
        'ecr:BatchDeleteImage',
        'ecr:BatchGetImage',
        'ecr:CompleteLayerUpload',
        'ecr:DescribeImages',
        'ecr:DescribeRepositories',
        'ecr:GetDownloadUrlForLayer',
        'ecr:GetLifecyclePolicy',
        'ecr:GetRepositoryPolicy',
        'ecr:ListImages',
        'ecr:UploadLayerPart',
      ],
    });

    ecrRepo.addToResourcePolicy(authorisationAccountsPermission);

    const dbSubnetGroup = new SubnetGroup(this, 'DatabaseSubnetGroup', {
      vpc,
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC
      },
      description: 'Public RDS instance',
    });

    const dbSecret = new Secret(this, 'DatabaseSecret', {
      secretName: process.env.DB_SECRET_NAME || 'api-db',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'api' }),
        generateStringKey: 'password',
        excludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'/@"\\',
      },
    });

    cdk.Tags.of(dbSecret).add('project', 'api');

    const cluster = new DatabaseInstance(this, 'Database', {
      vpc,
      engine: DatabaseInstanceEngine.mariaDb({
        version: MariaDbEngineVersion.VER_10_11,
      }),
      instanceType: InstanceType.of(InstanceClass.T4G, InstanceSize.MICRO),
      subnetGroup: dbSubnetGroup,
      credentials: Credentials.fromSecret(dbSecret),
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArnOutput', {
      value: dbSecret.secretArn,
      exportName: 'DatabaseSecretArn',
    });
  }
}
