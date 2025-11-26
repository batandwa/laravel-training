import * as cdk from 'aws-cdk-lib';
import { Instance, InstanceClass, InstanceSize, InstanceType, Vpc, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { Repository, TagMutability } from 'aws-cdk-lib/aws-ecr';
import { ClusterInstance, DatabaseCluster, DatabaseClusterEngine, DatabaseInstance, DatabaseInstanceEngine, MariaDbEngineVersion, MysqlEngineVersion, SubnetGroup, Credentials } from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = Vpc.fromLookup(this, "VPC", {
      vpcId: process.env.VPC_ID
    });

    new Repository(this, "Repo", {
      repositoryName: "api",
      imageTagMutability: TagMutability.IMMUTABLE,
    });

    const dbSubnetGroup = new SubnetGroup(this, 'DatabaseSubnetGroup', {
      vpc,
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC
      },
      description: 'Public RDS instance'
    });

    const cluster = new DatabaseInstance(this, 'Database', {
      vpc,
      engine: DatabaseInstanceEngine.mariaDb({
        version: MariaDbEngineVersion.VER_10_11
      }),
      instanceType: InstanceType.of(InstanceClass.T4G, InstanceSize.MICRO),
      subnetGroup: dbSubnetGroup,
      credentials: Credentials.fromGeneratedSecret('api'),
    });
  }
}
