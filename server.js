const fs = require("fs");
const path = require("path");
const fastify = require("fastify")({
  logger: false,
});

// Setup our static files
fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/",
});

// Formbody lets us parse incoming forms
fastify.register(require("@fastify/formbody"));

// View is a templating manager for fastify
fastify.register(require("@fastify/view"), {
  engine: {
    handlebars: require("handlebars"),
  },
});

const seo = require("./src/seo.json");

const customDomain = "complexorjbrasil.com.br";

//if (seo.url === "https://www.complexorjbrasil.com.br/") {
//  seo.url = `https://${process.env.PROJECT_DOMAIN}.glitch.me`;
//}

const data = require("./src/data.json");
const db = require("./src/" + data.database);

// Home route
fastify.get("/", async (request, reply) => {
  let params = request.query.raw ? {} : { seo: seo };
  const options = await db.getOptions();
  if (options) {
    params.optionNames = options.map((choice) => choice.language);
    params.optionCounts = options.map((choice) => choice.picks);
  } else params.error = data.errorMessage;

  if (options && params.optionNames.length < 1)
    params.setup = data.setupMessage;

  if (request.headers.host === customDomain) {
    seo.url = `https://${customDomain}`;
  }

  return request.query.raw
    ? reply.send(params)
    : reply.view("public/index.html", params);
});

// Post route to process user vote
fastify.post("/", async (request, reply) => {
  let params = request.query.raw ? {} : { seo: seo };
  params.results = true;
  let options;

  if (request.body.language) {
    options = await db.processVote(request.body.language);
    if (options) {
      params.optionNames = options.map((choice) => choice.language);
      params.optionCounts = options.map((choice) => choice.picks);
    }
  }
  params.error = options ? null : data.errorMessage;

  if (request.headers.host === customDomain) {
    seo.url = `https://${customDomain}`;
  }

  return request.query.raw
    ? reply.send(params)
    : reply.view("/src/pages/index.hbs", params);
});

// Admin endpoint returns log of votes
fastify.get("/logs", async (request, reply) => {
  let params = request.query.raw ? {} : { seo: seo };
  params.optionHistory = await db.getLogs();
  params.error = params.optionHistory ? null : data.errorMessage;

  if (request.headers.host === customDomain) {
    seo.url = `https://${customDomain}`;
  }

  return request.query.raw
    ? reply.send(params)
    : reply.view("/src/pages/admin.hbs", params);
});

// Admin endpoint to empty all logs
fastify.post("/reset", async (request, reply) => {
  let params = request.query.raw ? {} : { seo: seo };

  if (
    !request.body.key ||
    request.body.key.length < 1 ||
    !process.env.ADMIN_KEY ||
    request.body.key !== process.env.ADMIN_KEY
  ) {
    console.error("Auth fail");
    params.failed = "You entered invalid credentials!";
    params.optionHistory = await db.getLogs();
  } else {
    params.optionHistory = await db.clearHistory();
    params.error = params.optionHistory ? null : data.errorMessage;
  }

  if (request.headers.host === customDomain) {
    seo.url = `https://${customDomain}`;
  }

  const status = params.failed ? 401 : 200;
  return request.query.raw
    ? reply.status(status).send(params)
    : reply.status(status).view("/src/pages/admin.hbs", params);
});

// Endpoint to serve the password
fastify.get("/get-password", (request, reply) => {
  const passwordFilePath = path.join(__dirname, 'password.json');
  fs.readFile(passwordFilePath, 'utf8', (err, data) => {
    if (err) {
      reply.status(500).send('Erro ao ler o arquivo de senha');
      return;
    }
    reply.send(JSON.parse(data));
  });
});

// Run the server and report out to the logs
fastify.listen(
  { port: process.env.PORT, host: "0.0.0.0" },
  function (err, address) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Your app is listening on ${address}`);
  }
);


