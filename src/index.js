const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const program = require('commander');
const yaml = require('js-yaml');

const { Client } = require('./lib/client');
const { Prometheus } = require('./lib/prometheus');

const app = express();
const port = 3000;

program
  .option('-c, --config [path]', 'Path to config file.', '../config/main.yaml');

async function start(options={}) {

  const prometheus = new Prometheus(app);
  prometheus.startMetricsRoute();
  app.listen(port, () => console.log(`substrate-telemetry-exporter listening on port ${port}`))

  const cfg = readYAML(options.config);
  cfg.subscribe.chains.forEach(async (chain) => {
    const patterns = {
      activeNode: cfg[chain.toLowerCase()].active_node_pattern,
      passiveNode: cfg[chain.toLowerCase()].passive_node_pattern,
    };
    const client = new Client(cfg.telemetry_host, chain, patterns, cfg.inactive_node_time);
    prometheus.addChain(chain, client);
    await client.start();
    console.log(`Client started for chain ${chain} started.`);
  });

}

function readYAML(filePath) {
  const rawContent = fs.readFileSync(path.resolve(__dirname, filePath));

  return yaml.safeLoad(rawContent);
}

program.parse(process.argv);
start(program);
