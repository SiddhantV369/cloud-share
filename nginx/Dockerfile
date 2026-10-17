FROM nginx:alpine

# Remove default configuration and copy custom reverse proxy configuration
COPY default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
