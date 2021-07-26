/**
 *   NodeJS-PasteServer | Copyright © 2021 | vironlab.eu
 *      ___    _______                        ______         ______
 *      __ |  / /___(_)______________ _______ ___  / ______ ____  /_
 *      __ | / / __  / __  ___/_  __ \__  __ \__  /  _  __ `/__  __ \
 *      __ |/ /  _  /  _  /    / /_/ /_  / / /_  /___/ /_/ / _  /_/ /
 *      _____/   /_/   /_/     \____/ /_/ /_/ /_____/\__,_/  /_.___/
 *    ____  _______     _______ _     ___  ____  __  __ _____ _   _ _____
 *   |  _ \| ____\ \   / / ____| |   / _ \|  _ \|  \/  | ____| \ | |_   _|
 *   | | | |  _|  \ \ / /|  _| | |  | | | | |_) | |\/| |  _| |  \| | | |
 *   | |_| | |___  \ V / | |___| |__| |_| |  __/| |  | | |___| |\  | | |
 *   |____/|_____|  \_/  |_____|_____\___/|_|   |_|  |_|_____|_| \_| |_|
 *
 *   This program is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 *   Contact:
 *
 *     Discordserver:   https://discord.gg/wvcX92VyEH
 *     Website:         https://vironlab.eu/
 *     Mail:            contact@vironlab.eu
 *
 */

'use strict'; // https://www.w3schools.com/js/js_strict.asp

const VERSION = 'v1.0.0';

// ======================================================================================================================= //

const { Logger, C } = require('logger-nodejs-simple');
const { JsonDatabase, Document } = require('jsondatabase.js');
// ======================================================================================================================= //

const cookieParser = require('cookie-parser');
const serveStatic = require('serve-static');
const compression = require('compression');
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');

// ======================================================================================================================= //

const defpath = __dirname + '/';

const packageInfo = require('./package.json');
const config = require('./config.js');

// ======================================================================================================================= //

const PORT = config.server.port || 80;
const HOST = config.server.host;

const PORT_SSL = config.server.https.port || 443;
const SSL_CERT = defpath + '.SSL/' + config.server.https.cert;
const SSL_KEY = defpath + '.SSL/' + config.server.https.privateKey;
const SSL_ENABLED = config.server.https.enabled || false;
const SSL_FORCE = config.server.https.force || false;

// ======================================================================================================================= //

var server = {
    app: express(),
    config: config,
    port: PORT,
    host: HOST,
    modules: {},
    launchStart: Date.now(),
};

// ======================================================================================================================= //

server.logger = new Logger(Logger.LOG_LEVELS.DEBUG);
server.logger.info(`Starting PasteServer v${packageInfo.version}...`);

// ======================================================================================================================= //

const moduleList = ['fs', 'path', 'crypto', 'express', 'express-rate-limit'];

// cache often used modules
for (let modulename of moduleList) {
    try {
        let name = modulename;
        if (modulename.startsWith('./')) name = modulename.split('/')[modulename.split('/').length - 1];
        server.modules[name] = require(modulename);
        server.logger.debug('[MODULE LOADED] >> ' + name);
    } catch (err) {
        server.logger.err(err);
    }
}

// ======================================================================================================================= //

server.db = new JsonDatabase('./storage/database');
server.Document = Document;

// ======================================================================================================================= //

server.app.use(require('serve-favicon')(defpath + 'static/favicon.ico'));

// ======================================================================================================================= //

server.app.use(function (req, res, next) {
    res.removeHeader('X-Powered-By');
    next();
});
server.app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// ======================================================================================================================= //

server.app.get('/version', (req, res, next) => {
    return res.status(200).send(VERSION);
});

server.app.use((req, res, next) => (req.path.toLowerCase() === '/documents' && req.method === 'POST' ? next() : express.json({ limit: config.document.dataLimit, extended: true })(req, res, next)));
server.app.use(
    express.urlencoded({
        extended: true,
    }),
);
server.app.use(cookieParser());
server.app.use(compression());

// ======================================================================================================================= //

// Force https when SSL enabled
if (SSL_ENABLED && SSL_FORCE) {
    server.app.use((req, res, next) => {
        if (req.secure) {
            next();
        } else {
            return res.status(301).redirect('https://' + req.headers.host + req.url);
        }
    });
}

// ======================================================================================================================= //

/**
 * Server ROUTES
 */

server.app.use('/documents', require('./routes/documents')(server));

// ======================================================================================================================= //

server.app.use(serveStatic(defpath + 'static/'));
server.app.use('/:key', serveStatic(__dirname + '/static'));

// redirect 404 to homepage
server.app.use((req, res) => res.redirect('/'));

// ======================================================================================================================= //

// finally create server
const httpServer = http.createServer(server.app);
httpServer.listen(PORT, () => {
    server.logger.info('HTTP PasteServer running on port ' + PORT);
});

if (SSL_ENABLED) {
    const httpsServer = https.createServer(
        {
            key: fs.readFileSync(SSL_KEY),
            cert: fs.readFileSync(SSL_CERT),
        },
        server.app,
    );

    httpsServer.listen(PORT_SSL, () => {
        server.logger.info('HTTPS PasteServer running on port ' + PORT_SSL);
    });
}

server.logger.info(`Started PasteServer v${packageInfo.version}...`);

// ======================================================================================================================= //
