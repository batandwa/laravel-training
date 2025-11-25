FROM php:8.4-apache

RUN docker-php-ext-install mysqli pdo_mysql
RUN a2enmod rewrite

RUN rm -rf /var/www
COPY src/ /var/www/
RUN cp --recursive /var/www/public /var/www/html
