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

class TextBar {
    constructor(element) {
        this.textBarElement = element;
        element.querySelector('i').addEventListener('click', () => this.hide());
        this.textBarText = element.querySelector('p');
    }
    show(text, time) {
        this.textBarText.innerText = text;
        this.textBarElement.classList.add('show');

        if (time) setTimeout(() => this.hide(), time);
    }
    hide() {
        this.textBarText.innerText = '';
        this.textBarElement.classList.remove('show');
    }
}

class PastedDocument {
    constructor(pasteServer) {
        this.pasteServer = pasteServer;
        this.locked = false;
        this.key = null;
    }

    async load(key) {
        try {
            const response = await fetch('/documents/' + key, { method: 'GET' });
            if (response.ok) {
                const documentText = (await response.json()).text;
                NodeJSPasteServer.showElement(this.pasteServer.codeBox, true);
                NodeJSPasteServer.showElement(this.pasteServer.textArea, false);
                document.title = key + ' - NodeJS-PasteServer';
                this.pasteServer.updateCodeLines(documentText.split('\n').length);
                this.pasteServer.code.innerHTML = hljs.highlightAuto(documentText).value;
                this.pasteServer.textArea.readOnly = true;
                this.locked = true;
                this.key = key;
            } else window.location.href = window.location.href.split(key)[0];
        } catch (error) {
            console.error('Error while loading document: ', error);
        }
    }

    async save(text) {
        if (text.trim() === '') return;
        if (!this.locked) {
            try {
                const response = await fetch('/documents', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: text,
                });
                const json = await response.json();
                if (response.ok) {
                    const key = json.key;
                    window.history.pushState({}, 'NodeJS-PasteServer', '/' + key);
                    await this.load(key);
                    this.pasteServer.textBar.show('Secret to delete paste: ' + json.deleteSecret);
                } else if (json.message) {
                    const message = json.message;
                    this.pasteServer.textBar.show('Error while saving: ' + message, 3000);
                } else this.pasteServer.textBar.show('Unexpected error occurred while saving', 3000);
            } catch (error) {
                console.error('Error while saving document: ', error);
            }
        }
    }

    async delete(secret) {
        if (!this.key || !this.locked) return;
        try {
            const response = await fetch(`/documents/delete/${this.key}/${secret}`, { method: 'GET' });
            const json = await response.json();
            if (response.ok) window.location.href = window.location.href.split(self.key)[0];
            else if (json.message) {
                const message = json.message;
                this.pasteServer.textBar.show('Failed to delete document: ' + message, 3000);
            } else this.pasteServer.textBar.show('Unexpected error occurred while deleting', 3000);
        } catch (error) {
            console.error('Error while deleting document: ', error);
        }
    }
}

class NodeJSPasteServer {
    static showElement(element, show) {
        if (show) element.classList.remove('invisible');
        else element.classList.add('invisible');
    }

    constructor() {
        this.codeBox = document.getElementById('codeBox');
        this.codeBoxLines = this.codeBox.querySelector('.codeLines');
        this.code = this.codeBox.querySelector('code');
        NodeJSPasteServer.showElement(this.codeBox, false);

        this.textArea = document.querySelector('textarea');
        this.textBar = new TextBar(document.querySelector('.textBar'));
        this.textArea.select();

        this.currentDocument = new PastedDocument(this);

        this.setupShortcuts();
        this.setupButtons();
        this.setupModals();
    }

    async readURL() {
        const url = window.location.href.split('/');
        if (url.length > 3) {
            const key = url[3];
            if (key.trim() !== '') await this.currentDocument.load(key);
        }
    }

    setupShortcuts() {
        document.addEventListener('keydown', async (keyDownEvent) => {
            if (keyDownEvent.ctrlKey) {
                switch (keyDownEvent.code) {
                    case 'KeyS':
                        keyDownEvent.preventDefault();
                        await this.currentDocument.save(this.textArea.value);
                        break;
                    case 'KeyN':
                        keyDownEvent.preventDefault();
                        const url = window.location.href.split('/');
                        if (url.length > 2) window.location.href = 'http://' + url[2];
                        break;
                    case 'KeyD':
                        keyDownEvent.preventDefault();
                        if (this.currentDocument.locked) this.deleteModal.open();
                        break;
                    case 'KeyC':
                        if (keyDownEvent.altKey) {
                            keyDownEvent.preventDefault();
                            this.copyToClipboard();
                        }
                        break;
                }
            }
        });
    }

    setupButtons() {
        document.getElementById('saveButton').addEventListener('click', async () => await this.currentDocument.save(this.textArea.value));
        document.getElementById('copyButton').addEventListener('click', () => this.copyToClipboard());
        document.getElementById('newDocButton').addEventListener('click', () => {
            const url = window.location.href.split('/');
            if (url.length > 2) window.location.href = 'http://' + url[2];
        });
        document.getElementById('deleteButton').addEventListener('click', () => {
            if (this.currentDocument.locked) this.deleteModal.open();
        });
        const sidePanel = document.querySelector('.side-panel');
        document.querySelector('.collapse-button').addEventListener('click', () => {
            if (!sidePanel.classList.contains('collapsed')) sidePanel.classList.add('collapsed');
            else sidePanel.classList.remove('collapsed');
        });
    }

    setupModals() {
        M.Modal.init(document.querySelectorAll('.modal'), {});
        this.deleteModal = M.Modal.getInstance(document.getElementById('deleteModal'));
        this.deleteModal.options.onCloseEnd = () => {
            this.deleteSecretInput.value = '';
            this.deleteSecretInput.nextElementSibling.classList.remove('active');
        };
        this.deleteSecretInput = document.getElementById('deleteSecretInput');
        document.getElementById('modalDeleteButton').addEventListener('click', async () => await this.currentDocument.delete(this.deleteSecretInput.value));
    }

    copyToClipboard() {
        if (this.currentDocument.locked) {
            if (document.selection) {
                const range = document.body.createTextRange();
                range.moveToElementText(this.code);
                range.select();
            } else if (window.getSelection) {
                const range = document.createRange();
                range.selectNode(this.code);
                window.getSelection().removeAllRanges();
                window.getSelection().addRange(range);
            }
        } else this.textArea.select();
        document.execCommand('copy');
    }

    updateCodeLines(lineCount) {
        const codeLines = this.codeBoxLines;
        while (codeLines.firstChild) codeLines.removeChild(codeLines.firstChild);
        for (let i = 1; i < lineCount + 1; i++) {
            const lineTextNode = document.createTextNode(i.toString());
            const lineBreakElement = document.createElement('br');
            codeLines.appendChild(lineTextNode);
            codeLines.appendChild(lineBreakElement);
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const version = await (await fetch('/version/', { method: 'GET' })).text();
    document.querySelector('.version').innerHTML = version;
    await new NodeJSPasteServer().readURL();
});
