#!/usr/bin/env groovy

pipeline {
    agent {
        label 'slave-group-normal'
    }

    options {
        timeout(time: 20, unit: 'MINUTES')
    }

    stages {
        stage('Build') {
            steps {
                nodejs(nodeJSInstallationName: 'Node 8.11') {
                    sh 'rm -drf node_modules/'
                    sh 'npm config ls'
                    sh 'npm install'
                }
            }
        }
        stage('Docs') {
            steps {
                nodejs(nodeJSInstallationName: 'Node 8.11') {
                    sh './node_modules/.bin/jsdoc lib/*.js'
                }
            }
        }
        stage('Run server') {
            steps {
                sh './run-domain.sh --ci'
            }
        }
        stage('Test') {
            steps {
                sh 'rm -drf tmp-tests.log'

                nodejs(nodeJSInstallationName: 'Node 8.11') {
                    sh './node_modules/.bin/jasmine-node spec --captureExceptions --forceexit'
                }
            }
        }
        stage('Test with Hot Rod 2.5') {
            environment {
                protocol = "2.5"
            }

            steps {
                sh 'rm -drf tmp-tests.log'

                nodejs(nodeJSInstallationName: 'Node 8.11') {
                    sh './node_modules/.bin/jasmine-node spec --captureExceptions --forceexit'
                }
            }
        }
        stage('Test with Hot Rod 2.2') {
            environment {
                protocol = "2.2"
            }

            steps {
                sh 'rm -drf tmp-tests.log'

                nodejs(nodeJSInstallationName: 'Node 8.11') {
                    sh './node_modules/.bin/jasmine-node spec --captureExceptions --forceexit'
                }
            }
        }
    }
    post {
        failure {
            sh 'cat tmp-tests.log'
            sh 'cat server/*/domain/servers/server-earth-one/log/server.log'
            sh 'cat server/*/domain/servers/server-moon-one/log/server.log'
        }
    }
}
