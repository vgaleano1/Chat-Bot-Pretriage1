/*Declaracion de Librerias a Usar*/
var cfenv = require("cfenv");
var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var watson = require('watson-developer-cloud');
var extend = require('util')._extend;
/* Se declara la variable para extraer la carga Util */
var payload = {
	workspace_id : '06e2a3ff-d868-47c3-aec4-e9abc4d1c8f4',
	context : {},
	input : {}
};

/*
 * Funcion para Inicializar servicios usando las variables declaradas en Vcap
 * Bluemix
 */
function getServiceCredentialsFromBluemix(name) {
	if (process.env.VCAP_SERVICES) {
		var services = JSON.parse(process.env.VCAP_SERVICES);
		for ( var service_name in services) {
			if (service_name.indexOf(name) === 0) {
				var service = services[service_name][0];
				return {
					url : service.credentials.url,
					username : service.credentials.username,
					password : service.credentials.password,
					version_date : service.credentials.version_date
				};
			}
		}
	}
	return {};
}

/* Declaracion de variables para inicializar el servicio de Conversation */
var watsonDialogCredentials = extend({
	url : 'https://gateway.watsonplatform.net/conversation/api',
	username : '90cf85ff-a74f-4640-a2c9-6468be1bde0f' ,
	password : 'HWWMI7qOKfAA',
	version : 'v1',
	version_date : '2017-01-23'
}, getServiceCredentialsFromBluemix('Demo_Pre-Triage_Tos'));

/* Se instancia Conversation */
var conversation = watson.conversation(watsonDialogCredentials);
/* Variables de entorno Locales */
var token = process.env.TOKEN
		|| "EAAZAZB3HztaLwBAEX5DdLMYUjiaqzVgHHcvxBmPdcK14eqAIgXOdHKCUl4wYNiVu2yP76is58ZCnJQab7s0qvpiyT2uJSARpUu2ugnz91XJlqItCyqdns0yaCmifoOGHFaGamaK7o5lKbHWlppeTeA0OwXYVtACfZBC4dFiwkAZDZD";
var secret = process.env.SECRET || 'valorpendiente';
/* Inicializa servidor Node.js */
var appEnv = cfenv.getAppEnv();
var app = express();
app.use(bodyParser.json());
app.listen(appEnv.port, appEnv.bind, function() {
	console.log('listening on port ' + appEnv.port);
});

/* Se adiciona Path /webhook/ para integracion con Facebook */
app.get('/webhook/', function(req, res) {

	if (req.query['hub.verify_token'] === secret) {
		res.send(req.query['hub.challenge']);
	}
	res.send('Error, wrong validation token');
});

/* la funcion que envia el mensaje a Facebook */
function sendTextMessage(recipient, text) {
	sendtext = JSON.stringify(text.output.text);
	request({
		url : 'https://graph.facebook.com/v2.6/me/messages',
		qs : {
			access_token : token
		},
		method : 'POST',
		json : {
			recipient : {
				id : recipient
			},
			message : {
				text : sendtext
			}
		}
	},

	function(error, response, body) {
		if (error) {
			console.log('Error sending message: ', error);
		} else if (response.body.error) {
			console.log('Error: ', response.body.error);
		}
	});
}

/* La funcion que procesa lo que se envia desde facebook e invoca Conversation */
function processEvent(event) {
	var sender = event.sender.id;
	var text;
	if (event.message && event.message.text) {
		text = event.message.text;
		payload.input = {
			text : text
		};
		conversation.message(payload, function(err, data) {
			if (err) {
				console.log('error llamando el api de conversation', JSON
						.stringify(err));
				console.error(JSON.stringify(err));
				return res.status(err.code || 500).json(err);
			};
			
			payload.context =data.context;
			console.log("mensaje de texto");
			console.log(payload.context);
			
			sendTextMessage(sender, data);
		});

	}
}

/* Script pra recibir los mensajes desde facebook en /webhook/ */
app.post('/webhook/', function(req, res) {
	messaging_events = req.body.entry[0].messaging;
//	payload.context = req.body.context;
	for (i = 0; i < messaging_events.length; i++) {
		event = req.body.entry[0].messaging[i];
		processEvent(event);
	}
	res.sendStatus(200);
});
