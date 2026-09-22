pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  environment {
    IMAGE     = 'beverage-ledger-api'
    CONTAINER = 'beverage-ledger-api'
    NETWORK   = 'devops-net'
    HOST_PORT = '3001'
    APP_PORT  = '3001'

    // prisma.config.ts resolves its datasource with env('DIRECT_URL') and
    // throws when it is missing, and `prisma generate` runs from postinstall.
    // Nothing in this stage connects, so a syntactically valid placeholder is
    // enough and no database credential belongs in a build log.
    DATABASE_URL = 'postgresql://ci:ci@localhost:5432/ci'
    DIRECT_URL   = 'postgresql://ci:ci@localhost:5432/ci'

    COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'
  }

  stages {
    stage('Verify tools') {
      steps {
        sh '''
          set -e
          node --version
          corepack --version
          docker --version
          java -version
          git --version
        '''
      }
    }

    stage('Install dependencies') {
      steps {
        // src/generated is gitignored and five suites import its enums as
        // values, so the tests cannot even load without the explicit generate.
        // postinstall covers it too, but its failure is quiet enough to be
        // worth a step of its own.
        sh '''
          set -e
          corepack enable
          pnpm install --frozen-lockfile
          pnpm db:generate
        '''
      }
    }

    stage('Static analysis') {
      steps {
        sh '''
          set -e
          pnpm lint
          pnpm typecheck
          pnpm build
        '''
      }
    }

    stage('Tests and coverage') {
      steps {
        sh 'pnpm test:coverage --reporter=default --reporter=junit --outputFile.junit=reports/junit.xml'
      }
      post {
        always {
          junit allowEmptyResults: true, testResults: 'reports/junit.xml'
          // coverage/ is gitignored, so it only survives the build as an artifact.
          archiveArtifacts artifacts: 'coverage/lcov.info', allowEmptyArchive: true
        }
      }
    }

    stage('SonarQube analysis') {
      steps {
        script {
          def scannerHome = tool 'SonarScanner'
          // Host and token come from the server configured in Jenkins; every
          // other property stays in sonar-project.properties, which is also
          // what GitHub Actions reads.
          //
          // The JS/TS analyzer starts a Node bridge that sizes its heap from
          // the memory it sees, asking for 2.2GB on an 8GB host. On a small
          // machine that is what pushes the box into swap, where the analysis
          // stops being CPU-bound and starts taking tens of minutes. Capping it
          // costs nothing measurable: the sensor itself takes the same time.
          withSonarQubeEnv('SonarQube') {
            sh "${scannerHome}/bin/sonar-scanner -Dsonar.projectVersion=${env.BUILD_NUMBER} -Dsonar.javascript.node.maxspace=768"
          }
        }
      }
    }

    stage('Quality gate') {
      steps {
        // Depends on the SonarQube webhook pointing at
        // http://jenkins:8080/sonarqube-webhook/ — without it this waits out
        // the timeout instead of getting an answer.
        timeout(time: 10, unit: 'MINUTES') {
          waitForQualityGate abortPipeline: true
        }
      }
    }

    stage('Docker build') {
      steps {
        sh '''
          set -e
          docker build -t "${IMAGE}:${BUILD_NUMBER}" -t "${IMAGE}:latest" .
        '''
      }
    }

    stage('Deploy') {
      steps {
        // An env file rather than a series of -e flags: values passed with -e
        // are readable from `docker inspect` for anyone on the host. Docker
        // does not strip quotes from an env file, so the values are written
        // bare. The file is removed in post.
        withCredentials([
          string(credentialsId: 'bl-api-database-url', variable: 'DEPLOY_DATABASE_URL'),
          string(credentialsId: 'bl-api-direct-url', variable: 'DEPLOY_DIRECT_URL'),
          string(credentialsId: 'bl-api-jwt-secret', variable: 'DEPLOY_JWT_SECRET'),
        ]) {
          sh '''
            set -e
            umask 077
            cat > .deploy.env <<ENVFILE
NODE_ENV=production
PORT=${APP_PORT}
API_PREFIX=api/v1
SWAGGER_ENABLED=true
DATABASE_URL=${DEPLOY_DATABASE_URL}
DIRECT_URL=${DEPLOY_DIRECT_URL}
JWT_SECRET=${DEPLOY_JWT_SECRET}
CORS_ORIGINS=http://localhost:3000
FRONTEND_URL=http://localhost:3000
ENVFILE

            docker rm -f "${CONTAINER}" 2>/dev/null || true
            docker run -d \
              --name "${CONTAINER}" \
              --network "${NETWORK}" \
              --restart unless-stopped \
              --env-file .deploy.env \
              -p "${HOST_PORT}:${APP_PORT}" \
              "${IMAGE}:${BUILD_NUMBER}"
          '''
        }
      }
    }

    stage('Health check') {
      steps {
        // By container name, not localhost: this runs inside Jenkins, whose
        // localhost is its own container. The endpoint answers 503 when the
        // database is unreachable, so this covers the dependency too.
        sh '''
          set -e
          for attempt in $(seq 1 30); do
            if curl -fsS "http://${CONTAINER}:${APP_PORT}/api/v1/health"; then
              echo ""
              echo "healthy after ${attempt} attempt(s)"
              exit 0
            fi
            sleep 3
          done
          echo "the container never answered /api/v1/health"
          docker logs --tail 50 "${CONTAINER}"
          exit 1
        '''
      }
    }
  }

  post {
    failure {
      sh 'docker logs --tail 100 "${CONTAINER}" 2>/dev/null || true'
    }
    always {
      sh 'rm -f .deploy.env || true'
    }
    cleanup {
      sh 'docker image prune -f --filter "dangling=true" || true'
    }
  }
}
