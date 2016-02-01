#!/bin/bash

echo Sending RPM to nexus.

vnext="1.0-40";
nexusUrl="http://nexus.devops.geointservices.io" ;
repoUrl="content/repositories/FADE-Releases";
file="../artifacts/Mage-Server-1.0-1.x86_64.rpm";

mvn -q deploy:deploy-file -Dfile=$file -DrepositoryId=nexus -Durl="$nexusUrl/$repoUrl" -DgroupId=mage -DartifactId=mage-server -Dversion=$vnext -DgeneratePom=true -Dpackaging=rpm -e

