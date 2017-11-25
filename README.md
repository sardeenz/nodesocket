1. start redis db $redis-server
2. start redis cli $redis-cli
3. check any existing data in redis via cli - 127.0.0.1:6379> zrange geo:locations 0 -1 withscores
4. start node server $node index.js

