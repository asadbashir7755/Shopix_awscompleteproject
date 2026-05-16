mysql> create database shopix;
Query OK, 1 row affected (0.01 sec)

mysql> create user 'shopix'@'localhost' identified by 'Shopix6734#$%';
Query OK, 0 rows affected (0.03 sec)

mysql> grant all privileges on shopix.* to 'shopix'@'localhost';
Query OK, 0 rows affected (0.01 sec)



docker run -d --env-file .env.local --network host -e HOSTNAME=0.0.0.0 shopix:latest 

