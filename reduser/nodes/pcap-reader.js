module.exports = function(RED) {
    function LowerCaseNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        this.on('input', function(msg) {
            msg.payload = msg.payload.toLowerCase();
            console.log(JSON.stringify(msg), config, this.context().flow);
            node.send(msg);
        });
    }
    RED.nodes.registerType("pcap-reader",LowerCaseNode);
}
