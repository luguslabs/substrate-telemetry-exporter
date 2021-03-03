class Node {
    constructor(
      id,
      nodeDetails,
      nodeStats,
      nodeIO,
      nodeHardware,
      blockDetails,
      location,
      startupTime,
      patterns,
      inactiveNodeTime
    ) {
      const [name, implementation, version, validator, networkId] = nodeDetails;
  
      this.id = id;
      this.name = name;
      this.implementation = implementation;
      this.version = version;
      this.validator = validator;
      this.networkId = networkId;
      this.startupTime = startupTime;
      this.patterns = patterns;
      this.inactiveNodeTime = inactiveNodeTime;

      const [major = 0, minor = 0, patch = 0] = (version || '0.0.0')
        .split('.')
        .map((n) => parseInt(n, 10) | 0);
  
      this.sortableName = name.toLocaleLowerCase();
      this.sortableVersion = (major * 1000 + minor * 100 + patch) | 0;
  
      this.updateStats(nodeStats);
      this.updateIO(nodeIO);
      this.updateHardware(nodeHardware);
      this.updateBlock(blockDetails);

      this.lastSeen = Date.now();
  
      if (location) {
        this.updateLocation(location);
      }
    }
  
    getNodeType() {
      if (this.name.includes(this.patterns.activeNode)) {
        return "validator"
      }
      if (this.name.includes(this.patterns.passiveNode)) {
        return "passive"
      } 
      return "other"
    }

    isNodeAlive() {
        return Date.now() - this.lastSeen < this.inactiveNodeTime * 1000;
    }

    recievedUpdates() {
        this.lastSeen = Date.now();
    }
    
    updateStats(stats) {
      const [peers, txs] = stats;
  
      this.peers = peers;
      this.txs = txs;

      this.recievedUpdates();
    }
  
    updateIO(io) {
      const [stateCacheSize] = io;
  
      this.stateCacheSize = stateCacheSize;

      this.recievedUpdates();
    }
  
    updateHardware(hardware) {
      const [upload, download, chartstamps] = hardware;
  
      this.upload = upload;
      this.download = download;
      this.chartstamps = chartstamps;

      this.recievedUpdates();
    }
  
    updateBlock(block) {
      const [height, hash, blockTime, blockTimestamp, propagationTime] = block;
  
      this.height = height;
      this.hash = hash;
      this.blockTime = blockTime;
      this.blockTimestamp = blockTimestamp;
      this.propagationTime = propagationTime;
      this.stale = false;

      this.recievedUpdates();
    }

    setStale(stale) {
        this.stale = stale;
    }
  
    updateFinalized(height, hash) {
      this.finalized = height;
      this.finalizedHash = hash;

      this.recievedUpdates();
    }
  
    updateLocation(location) {
      const [lat, lon, city] = location;
  
      this.lat = lat;
      this.lon = lon;
      this.city = city;

      this.recievedUpdates();
    }
  
}

module.exports = {
    Node
}
