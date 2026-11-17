FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src src
RUN mvn -B -ntp -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/sharehub-0.1.0.jar sharehub.jar
ENTRYPOINT ["java", "-jar", "sharehub.jar"]
