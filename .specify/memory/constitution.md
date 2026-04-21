# Secret-Santa-BE V2 Constitution

## Core Principles
Any mention of API or application is distinctive from Terraform.
Any mention of "run build" means "npm run build"

### Domain Driven
There are three domains: "user", "admin", "authentication". Each covers it's own domain which represents a logical seperation from the other domains. Each domain should be able to be independently deployed.

### AWS Based
Each domain should be deployed as it's own ECS Task (within its own target group), behind a load balancer. The load balancer should have event rules that direct traffic to the correct target group.

DynamoDB will be the backend database that will store data for this application.

### OpenAPI Spec Control
All domains should have it's own OpenAPI Spec that can be leveraged for testing

### Language Requirements
Must use node 25.8.2, typescript 6.0.2.

#### Typescript requirements
verbatimModuleSyntax is set to true, ensure to always follow verbatim syntax

### Observability
Every method should be able to be traced with logs. It is important to understand how a call is traveling through the API.

### Authentication
Auth0 must be used as the authentication to access any resources.

## Infrastructure
### AWS
AWS is the hosting platform for this suite of applications. Environments include 'dev', 'prod'.

### Terraform
Use Terraform 1.14.8 to interact with AWS. Ensure to use best practices when constructing Terraform structure. The terraform structure must be in it's own project and define the setup for the entire suite of applications. Terraform will store tsstate within S3.

#### Variables
All variable definitions must be stored on a per environment basis. Ensure to prioritize creating variables for items that would require adjusting based on the environment it is currently in, such as size requirements, name definitions (where it will vary).

## Development Workflow
### Phase 1: Code modifications
1. Developer creates a repository branch (/feat, /bugix, /hotfix) based off the 'main' branch 
2. Developer checks out the code from the repository branch just created
3. Developer writes code modifications which includes additional or modified test cases based off the code modifications made
4. Developer performs typescript build (npm run build) to ensure proper build as well as run all the tests to ensure 100% pass rate, and 90% coverage
5. Developer commits and pushes to a repository branch based off the 'main' branch

### Phase 2: PR Process
1. Developer creates a PR which requests the code to be merged into 'main'
2. GitHub Actions runs a pipeline based off of the PR which runs the typescript build and test to ensure everything passes.
3.a If the developer requires modifications based on reviews or build/test failures, the developer proceeds with Phase 1 again to correct the code
3.b If the developer gets all necessary approvals, the developer merges the code into the 'main' branch

### Phase 3: GitHub Actions
1. GitHub Actions performs a build and test based off the new code that has been merged into 'main'
2. GitHub Actions stores the artifact from the build to pass to the deployment step
3. For Terraform, GitHub Actions will execute the build to modify the AWS infrastructure. For API builds, the artifact built will be deployed as a new ECR image and a new task version will be created for the related API, which is then deployed for the ECS service.
4. GitHub Actions needs to perform health checks either on its own by triggering the API or via CLI on the target group. Health checks are required for the build to pass, if the health check fails, then the build fails.

## Build

### Docker
Each API will be built using Docker. Use node:lts-alpine as the base image. Each Docker image must be able to be accessed through the network from the underlying EC2 system that is used.

#### Naming
API images will be named as the following - secret-santa-v2-[the domain]

### Application Build
Each application will be built using GitHub Actions. The application must perform a pipeline with basic typescript build and testing feature before it proceeds to deploy the application.

## Testing Requirements

### Unit Testing
Ensure that there is a 90% unit coverage for every typescript project. Ensure that tests are not overly complex and test simple flows with minimal changes to characters for basic functionality and logical checks.

## Web Access
### Route53
Route53 is being used with 'reinhardtvanwyk.com' as the CNAME record. The full CNAME will be 'secretsantabe.reinhardtvanwyk.com'.

### ALB
Route 53 will connect to the ALB which will handle load balancing on the traffic. An existing VPC named 'reinhardtvanwyk.com_2' will be used. Public and private subnets exists. Routing will take place based off the uri to target groups.
- /admin -> admin domain
- /user -> user domain
- /auth -> auth domain

### Target Group Routing
Target groups will be created and will use the smallest instance of EC2 available. Prefer general performance. Prefer free tier eligible. Standard health checks are fine.

**Version**: 1.0 | **Ratified**: 04/17/2026 | **Last Amended**: 04/17/2026
