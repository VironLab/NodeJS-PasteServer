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

// ======================================================================================================================= //

module.exports = (server) => {
    const express = server.modules['express'];
    const router = express.Router();

    const crypto = server.modules['crypto'];

    const rateLimit = server.modules['express-rate-limit'];
    const rateLimiter = rateLimit({
        windowMs: server.config.rateLimit.timeInMs,
        max: server.config.rateLimit.maxRequestsPerTime,
        message: {
            message: 'Request limit reached. Try again later',
        },
    });

    const keyCreator = require('../storage/key/keyCreator');

    const rawBodyHandle = (req, res, next) => {
        req.setEncoding('utf8');
        let rawBody = '';
        req.on('data', (data) => (rawBody += data));
        req.on('end', () => {
            req.rawBody = rawBody;
            next();
        });
    };

    const dataCollection = server.db.getCollection(server.config.document.databaseCollection || 'data');

    router.post(
        '/',
        server.config.rateLimit.enabled
            ? rateLimiter
            : (req, res, n) => {
                  n();
              },
        rawBodyHandle,
        async (req, res, next) => {
            const text = req.rawBody;
            res.setHeader('Content-Type', 'application/json');
            if (!text) {
                await res.status(400).json({
                    message: 'You have to provide the text of the paste',
                });
                return;
            }
            const maxLength = server.config.document.maxLength;

            if (text && text.length < maxLength) {
                const key = keyCreator.createKey();
                const deleteSecret = keyCreator.createKey(Math.floor(Math.random() * 16) + 12);
                const deleteSecretHash = crypto.createHash('sha256').update(deleteSecret).digest('hex');

                var databaseDocument = server.Document.from({
                    key: key,
                    deleteSecretHash: deleteSecretHash,
                    text: text,
                    inserted: Date.now(),
                });

                dataCollection.insertDocument(databaseDocument);
                server.logger.debug(`Inserted document: ${key}.`);

                await res.status(201).json({
                    key: key,
                    deleteSecret: deleteSecret,
                });
            } else {
                await res.status(413).json({
                    message: `Text too long (max. ${maxLength})`,
                });
            }
        },
    );

    router.get('/:key', async (req, res) => {
        const key = req.params.key;
        res.setHeader('Content-Type', 'application/json');
        var text;
        try {
            text = dataCollection.findOne({
                key: key,
            }).data.text;
        } catch (error) {}
        if (text == null) {
            await res.status(404).json({
                message: 'No document with that key found',
            });
        } else {
            await res.status(200).json({
                text: text,
            });
        }
    });

    router.get(
        '/delete/:key/:deleteSecret',
        server.config.rateLimit.enabled
            ? rateLimiter
            : (req, res, n) => {
                  n();
              },
        async (req, res) => {
            const key = req.params.key;
            const deleteSecret = req.params.deleteSecret || req.params.secret;

            res.setHeader('Content-Type', 'application/json');

            if (!deleteSecret) {
                res.status(400).json({
                    message: 'You have to enter the secret of the paste',
                });
                return;
            }

            const deleteSecretHash = crypto.createHash('sha256').update(deleteSecret).digest('hex');
            var data = dataCollection.findOne({
                key: key,
            }).data;

            if (!data || data.deleteSecretHash != deleteSecretHash) {
                return await res.status(403).json({
                    message: 'You entered the wrong secret or the document does not exist',
                });
            }

            dataCollection.deleteOneDocument({ key: data.key });

            server.logger.debug(`Deleted document: ${key}.`);
            await res.status(200).json({
                message: 'Success',
            });
        },
    );

    router.get('*', (req, res) => {
        res.redirect('/');
    });

    return router;
};
