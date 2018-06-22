const express = require('express');
const path = require('path');
const axios = require('axios');
const redis = require('redis');
const bluebird = require("bluebird");

const app = express();

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const API_URL = 'http://data.fixer.io/api';
const API_KEY = process.env.API_KEY;
const REDIS_URL = process.env.REDIS_URL;

// connect to Redis
const client = redis.createClient(REDIS_URL);

client.on('connect', () => {
    console.log(`connected to redis`);
});
client.on('error', err => {
    console.log(`Error: ${err}`);
});

app.get('/', (req, res) => {
  res.sendFile('index.html', {
    root: path.join(__dirname, 'views')
  });
});

app.get('/rate/:date', (req, res) => {
  const date = req.params.date;
  const url = `${API_URL}/${date}?base=EUR&access_key=${API_KEY}`;

  const countKey = `EUR:${date}:count`;
  const ratesKey = `EUR:${date}:rates`;

  let count;
  client
    .incrAsync(countKey)
    .then(result => {
        count = result;
        return count;
    })
    .then(() => client.hgetallAsync(ratesKey))
    .then(rates => {
        if (rates) {
            return res.json({ rates , count})
        }
        axios.get(url).then(response => {
            client
                .hmsetAsync(ratesKey, response.data.rates)
                .catch(e => console.log(e))
            return res.json({ rates: response.data.rates, count })
        }).catch(error => res.json(error.response.data))
    }).catch(e => console.log(e))
});

const port = process.env.port || 5000;

app.listen(port, () => {
  console.log(`App listening on port ${port}!`)
});