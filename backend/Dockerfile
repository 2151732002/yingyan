FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B package -DskipTests
FROM eclipse-temurin:21-jre-jammy
RUN useradd -m yingyan
WORKDIR /app
COPY --from=build /app/target/yingyan-server-0.1.0.jar app.jar
RUN mkdir -p /app/data && chown -R yingyan:yingyan /app
USER yingyan
ENV PORT=8080 JAVA_TOOL_OPTIONS="-Djava.awt.headless=true -Duser.timezone=Asia/Shanghai"
EXPOSE 8080
ENTRYPOINT ["java","-jar","app.jar"]
