FROM grafana/alloy:v1.8.3
COPY config.alloy /etc/alloy/config.alloy
EXPOSE 12345
CMD ["run", "/etc/alloy/config.alloy", "--storage.path=/var/lib/alloy/data", "--server.http.listen-addr=0.0.0.0:12345"]
