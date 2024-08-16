const dgram = require("dgram");
const server = dgram.createSocket("udp4");

const DHCP_PORT = 67;

// Función para convertir un buffer a una dirección IP
function bufferToIP(buffer) {
  return Array.from(buffer).join(".");
}

// Función para interpretar las opciones DHCP
function parseDHCPOptions(buffer) {
  let options = {};
  let index = 0;

  // Mapa de códigos de opciones a descripciones legibles
  const optionDescriptions = {
    1: "Subnet Mask",
    3: "Router",
    6: "DNS Servers",
    12: "Host Name",
    15: "Domain Name",
    50: "Requested IP Address",
    51: "IPAddress Lease Time",
    53: "Message Type",
    54: "Server Identifier",
    55: "Parameter Request List",
    57: "Maximum DHCP Message Size",
    60: "Vendor Class Identifier",
    61: "Client Identifier",
  };

  function parseParameterRequestList(value) {
    const parameters = {
      1: "Subnet Mask",
      3: "Router",
      6: "DNS Servers",
      12: "Host Name",
      15: "Domain Name",
      51: "IPAddress Lease Time",
      53: "Message Type",
      54: "Server Identifier",
      55: "Parameter Request List",
      57: "Maximum DHCP Message Size",
      60: "Vendor Class Identifier",
      61: "Client Identifier",
    };
    return value
      .map((code) => parameters[code] || `Unknown (${code})`)
      .join(", ");
  }

  while (index < buffer.length) {
    const option = buffer[index++];
    if (option === 255) {
      // Fin de opciones
      break;
    }
    const length = buffer[index++];
    const value = buffer.slice(index, index + length);
    index += length;

    switch (option) {
      case 55:
        options["Parameter Request List"] = parseParameterRequestList(value);
        break;
      case 1:
        options["Subnet Mask"] = bufferToIP(value);
        break;
      case 3:
        options["Router"] = bufferToIP(value);
        break;
      case 6:
        options["DNS Servers"] = bufferToIP(value);
        break;
      case 12:
        options["Host Name"] = value.toString();
        break;
      case 15:
        options["Domain Name"] = value.toString();
        break;
      case 50:
        options["Requested IP Address"] = bufferToIP(value);
        break;
      case 51:
        options["IPAddress Lease Time"] = value.readUInt32BE(0);
        break;
      case 53:
        options["Message Type"] = value[0];
        break;
      case 54:
        options["Server Identifier"] = bufferToIP(value);
        break;
      case 57:
        options["Maximum DHCP Message Size"] = value.readUInt16BE(0);
        break;
      case 60:
        options["Vendor Class Identifier"] = value.toString();
        break;
      case 61:
        options["Client Identifier"] = value.toString("hex");
        break;
      default:
        options[`Option ${option}`] = value.toString("hex");
    }
  }

  return options;
}

server.on("message", (msg, rinfo) => {
  // Interpretar campos básicos
  const op = msg[0]; // Operación (1 para BOOTREQUEST)
  const htype = msg[1]; // Tipo de hardware (1 para Ethernet)
  const hlen = msg[2]; // Longitud del hardware (6 para MAC)
  const hops = msg[3];
  const xid = msg.readUInt32BE(4); // Identificador de transacción
  const secs = msg.readUInt16BE(8);
  const flags = msg.readUInt16BE(10);
  const ciaddr = bufferToIP(msg.slice(12, 16)); // Dirección IP del cliente
  const yiaddr = bufferToIP(msg.slice(16, 20)); // Dirección IP asignada
  const siaddr = bufferToIP(msg.slice(20, 24)); // Dirección IP del servidor
  const giaddr = bufferToIP(msg.slice(24, 28)); // Dirección IP del relay
  const chaddr = msg.slice(28, 34).toString("hex"); // Dirección MAC del cliente
  const sname = msg.slice(44, 108).toString("utf8").trim(); // Nombre del servidor
  const file = msg.slice(108, 236).toString("utf8").trim(); // Nombre del archivo
  const magicCookie = msg.readUInt32BE(236); // Cookie mágico (0x63825363)
  const options = parseDHCPOptions(msg.slice(240)); // Opciones DHCP

  console.log("DHCP message received:");
  console.log(`  Operation: ${op}`);
  console.log(`  Hardware Type: ${htype}`);
  console.log(`  Hardware Length: ${hlen}`);
  console.log(`  Hops: ${hops}`);
  console.log(`  Transaction ID: ${xid}`);
  console.log(`  Seconds: ${secs}`);
  console.log(`  Flags: ${flags}`);
  console.log(`  Client IP Address: ${ciaddr}`);
  console.log(`  Your IP Address: ${yiaddr}`);
  console.log(`  Server IP Address: ${siaddr}`);
  console.log(`  Gateway IP Address: ${giaddr}`);
  console.log(`  Client Hardware Address: ${chaddr}`);
  console.log(`  Server Name: ${sname}`);
  console.log(`  File: ${file}`);
  console.log(`  Magic Cookie: ${magicCookie.toString(16)}`);
  console.log("  Options:", options);
});

server.bind(DHCP_PORT, () => {
  console.log(`Listening for DHCP messages on port ${DHCP_PORT}`);
});

server.on("error", (err) => {
  console.error(`Server error:\n${err.stack}`);
  server.close();
});
