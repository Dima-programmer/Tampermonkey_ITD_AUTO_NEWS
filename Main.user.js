// ==UserScript==
// @name         KOD Durova News Monitor
// @namespace    https://github.com/Dima-programmer/Tampermonkey_ITD_AUTO_NEWS
// @updateURL    https://github.com/Dima-programmer/Tampermonkey_ITD_AUTO_NEWS/raw/refs/heads/main/Main.user.js
// @downloadURL  https://github.com/Dima-programmer/Tampermonkey_ITD_AUTO_NEWS/raw/refs/heads/main/Main.user.js
// @version      2.9.5
// @description  Мониторит kod.ru и показывает уведомление при новых новостях
// @author       Дмитрий (#дым)
// @match        https://*.xn--d1ah4a.com/*
// @exclude      https://*.xn--d1ah4a.com/login
// @exclude      https://*.xn--d1ah4a.com/register
// @icon         https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSm6l1vcWXg3vAHjTU1oCaHzZIrD9jNiCE9-A&s
// @tag          social media
// @tag          utilities
// @tag          news
// @supportURL   https://t.me/dmitrii_gr
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    let lastNewsLinks = [];
    let activeNotifications = [];
    let allNotifications = [];

    lastNewsLinks = JSON.parse(localStorage.getItem('lastNewsLinks')) || [];
    allNotifications = JSON.parse(localStorage.getItem('allNotifications')) || [];

    function saveLastNewsLinks() {
        localStorage.setItem('lastNewsLinks', JSON.stringify(lastNewsLinks));
    }
    function saveAllNotifications() {
        localStorage.setItem('allNotifications', JSON.stringify(allNotifications));
    }

    // Функция для парсинга ссылки на новость из HTML
    function parseNewsLinkFromHTML(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const linkElement = doc.querySelector('a[class^="PostNews_imageWrap__"]');
        if (linkElement) {
            let href = linkElement.href;
            // Если ссылка абсолютная, заменяем домен на kod.ru
            if (href.startsWith('https://')) {
                href = href.replace(/^https:\/\/[^\/]+/, 'https://kod.ru');
            } else if (href.startsWith('/')) {
                // Если относительная, добавляем kod.ru
                href = 'https://kod.ru' + href;
            }
            return href;
        }
        return null;
    }

    // Функция для парсинга заголовка и текста из HTML новости
    function parseNewsContentFromHTML(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Заголовок: первый h1, у которого среди классов есть NewsTitle_title__[рандомные символы]
        const titleElement = doc.querySelector('h1[class*="NewsTitle_title__"]');
        const title = titleElement ? titleElement.textContent.trim().toUpperCase() : 'ЗАГОЛОВОК НЕ НАЙДЕН';

        // Текст: первый div, у которого среди классов есть NewsDetail_content__[рандомные символы]
        const articleElement = doc.querySelector('div[class*="NewsDetail_content__"]');
        let text = '';
        if (articleElement) {
            // Рекурсивная функция для сбора текста из всех тегов с текстовым содержимым
            function getTextRecursive(element) {
                let result = '';
                for (let child of element.childNodes) {
                    if (child.nodeType === Node.TEXT_NODE) {
                        result += child.textContent;
                    } else if (child.nodeType === Node.ELEMENT_NODE) {
                        result += getTextRecursive(child);
                        // Добавляем перенос строки после блочных элементов для сохранения структуры
                        if (['P', 'DIV', 'BR', 'H1', 'H2', 'H3', 'UL', 'OL', 'LI'].includes(child.tagName)) {
                            result += '\n';
                        }
                    }
                }
                return result;
            }
            text = getTextRecursive(articleElement).trim();
        } else {
            text = 'ТЕКСТ НЕ НАЙДЕН';
        }

        // Изображение: первый div с классом начинающимся на Poster_cover__, внутри img
        const imageElement = doc.querySelector('div[class*="Poster_cover__"] img');
        let imageSrc = imageElement ? imageElement.src : null;
        if (imageSrc && imageSrc.startsWith('/')) {
            imageSrc = 'https://kod.ru' + imageSrc;
        }

        return { title, text, imageSrc };
    }

    // Функция для проверки новостей с использованием GM_xmlhttpRequest
    function checkForNewNews() {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://kod.ru',
                onload: function(response) {
                    if (response.status === 200) {
                        const html = response.responseText;
                        const link = parseNewsLinkFromHTML(html);
                        if (link) {
                            // Загружаем содержимое новости
                            GM_xmlhttpRequest({
                                method: 'GET',
                                url: link,
                                onload: function(newsResponse) {
                                    if (newsResponse.status === 200) {
                                        const newsHtml = newsResponse.responseText;
                                        const { title, text, imageSrc } = parseNewsContentFromHTML(newsHtml);
                                        resolve({ link, title, text, imageSrc });
                                    } else {
                                        reject(new Error('Ошибка загрузки новости: ' + newsResponse.status));
                                    }
                                },
                                onerror: function(error) {
                                    reject(error);
                                }
                            });
                        } else {
                            resolve(null);
                        }
                    } else {
                        reject(new Error('Ошибка загрузки: ' + response.status));
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    // Функция для обновления кнопок отправки для данной ссылки
    function updateSendButtonsForLink(link) {
        document.querySelectorAll('[data-link="' + link + '"] button').forEach(button => {
            if (button.textContent === 'ОТПРАВИТЬ НОВОСТЬ') {
                button.textContent = '✓';
                button.style.backgroundColor = 'rgba(0,255,0,0.3)';
                button.style.cursor = 'default';
                button.disabled = true;
            }
        });
    }

    // Функция для создания уведомления
    function createNotification(newsData) {
        const { link, title, text, imageSrc, sent = false } = newsData;
        const hashtags = '\n\n#kod #itdkod\nСоздатели: 🤯@dmitrii_gr( #дым )  🕶@Artemius( #cakepopular )';
        const fullText = title + '\n\n' + text + hashtags;

        const notification = document.createElement('div');
        notification.id = 'tass-notification';
        notification.setAttribute('data-link', link);
        notification.style.cssText = `
            position: fixed;
            left: 5%;
            width: 90%;
            max-width: 800px;
            background: linear-gradient(135deg, #4d79ff, #0033cc);
            color: white;
            padding: 20px;
            box-sizing: border-box;
            z-index: 10000;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 14px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 15px;
            transform: translateY(-120%);
            transition: top 0.6s ease, transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.6s ease;
            backdrop-filter: blur(10px);
            opacity: 1;
        `;

        const textContainer = document.createElement('div');
        textContainer.style.flex = '1';
        textContainer.style.marginRight = '20px';
        textContainer.innerHTML = `<strong style="font-weight: 600;">📰 НОВОСТЬ KOD.RU:</strong><br><a href="${link}" target="_blank" style="color: #ffe6e6; text-decoration: none; font-weight: 500;">${title}</a>`;

        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.gap = '10px';

        const copyButton = document.createElement('button');
        copyButton.textContent = 'КОПИРОВАТЬ';
        copyButton.style.cssText = `
            background-color: rgba(255,255,255,0.2);
            color: white;
            border: 1px solid rgba(255,255,255,0.3);
            padding: 10px 15px;
            cursor: pointer;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 500;
            transition: background-color 0.3s ease;
        `;
        copyButton.onmouseover = () => copyButton.style.backgroundColor = 'rgba(255,255,255,0.3)';
        copyButton.onmouseout = () => copyButton.style.backgroundColor = 'rgba(255,255,255,0.2)';
        copyButton.onclick = async function() {
            try {
                await navigator.clipboard.writeText(fullText);
                const originalText = copyButton.textContent;
                copyButton.textContent = '✓';
                copyButton.disabled = true;
                copyButton.style.backgroundColor = 'rgba(0,255,0,0.3)';
                setTimeout(() => {
                    copyButton.textContent = originalText;
                    copyButton.disabled = false;
                    copyButton.style.backgroundColor = 'rgba(255,255,255,0.2)';
                }, 2000);
            } catch (error) {
                console.error('Ошибка копирования:', error);
            }
        };

        const sendButton = document.createElement('button');
        sendButton.textContent = sent ? '✓' : 'ОТПРАВИТЬ НОВОСТЬ';
        sendButton.style.cssText = `
            background-color: ${sent ? 'rgba(0,255,0,0.3)' : 'rgba(255,255,255,0.2)'};
            color: white;
            border: 1px solid rgba(255,255,255,0.3);
            padding: 10px 15px;
            cursor: ${sent ? 'default' : 'pointer'};
            border-radius: 8px;
            font-size: 12px;
            font-weight: 500;
            transition: background-color 0.3s ease;
            text-align: center;
            min-width: 120px;
        `;
        if (!sent) {
            sendButton.onmouseover = () => sendButton.style.backgroundColor = 'rgba(255,255,255,0.3)';
            sendButton.onmouseout = () => sendButton.style.backgroundColor = 'rgba(255,255,255,0.2)';
        }
        sendButton.onclick = async function() {
            if (sent) return;
            if (typeof create_post === 'function') {
                try {
                    const result = await create_post(fullText, imageSrc);
                    if (result && typeof result.then === 'function') {
                        await result;
                    } else if (result === false) {
                        throw new Error('Failed');
                    }
                    sendButton.textContent = '✓';
                    sendButton.disabled = true;
                    sendButton.style.cursor = 'default';
                    sendButton.style.backgroundColor = 'rgba(0,255,0,0.3)';
                    newsData.sent = true;
                    saveAllNotifications();
                    updateSendButtonsForLink(link);
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.remove();
                        }
                    }, 2000);
                } catch (error) {
                    console.error('Ошибка при вызове create_post:', error);
                    const originalText = sendButton.textContent;
                    sendButton.textContent = '×';
                    sendButton.disabled = true;
                    sendButton.style.backgroundColor = 'rgba(255,0,0,0.3)';
                    setTimeout(() => {
                        sendButton.textContent = originalText;
                        sendButton.disabled = false;
                        sendButton.style.backgroundColor = 'rgba(255,255,255,0.2)';
                    }, 2000);
                }
            } else {
                console.error('Функция create_post не найдена!');
            }
        };

        buttonsContainer.appendChild(copyButton);
        buttonsContainer.appendChild(sendButton);
        notification.appendChild(textContainer);
        notification.appendChild(buttonsContainer);

        const closeButton = document.createElement('span');
        closeButton.textContent = '✕';
        closeButton.title = 'Закрыть';
        closeButton.style.cssText = `
            font-size: 20px;
            cursor: pointer;
            color: white;
            margin-left: 10px;
            transition: color 0.3s ease;
        `;
        closeButton.onmouseover = () => closeButton.style.color = '#ffe6e6';
        closeButton.onmouseout = () => closeButton.style.color = 'white';
        closeButton.onclick = function() {
            notification.style.transform = 'translateY(-120%)';
            notification.style.opacity = '0';
            setTimeout(() => {
                const index = activeNotifications.indexOf(notification);
                if (index > -1) {
                    activeNotifications.splice(index, 1);
                }
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                updateNotificationPositions();
            }, 600);
        };
        notification.appendChild(closeButton);

        document.body.appendChild(notification);

        activeNotifications.unshift(notification);
        updateNotificationPositions();

        setTimeout(() => {
            notification.style.transform = 'translateY(-100%)';
        }, 10);
        setTimeout(() => {
            notification.style.transform = 'translateY(0)';
        }, 150);

        setTimeout(() => {
            if (notification.parentNode) {
                closeButton.onclick();
            }
        }, 20000);
    }


    // Функция для обновления позиций уведомлений
    function updateNotificationPositions() {
        activeNotifications.forEach((notification, index) => {
            const topPosition = 20 + index * 100; // Увеличенное расстояние между уведомлениями
            notification.style.top = `${topPosition}px`;
            notification.style.transform = 'translateY(0)';
        });
    }

    // Функция для создания статичной кнопки
    function createManualButton() {
        const button = document.createElement('button');
        button.id = 'manual-news-button';
        button.title = 'Показать уведомление о последней новости';
        button.innerHTML = '🔄';
        button.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #4d79ff, #0033cc);
            color: white;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            z-index: 9999;
            font-size: 20px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        button.onmouseover = () => {
            button.style.transform = 'scale(1.1)';
            button.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.2)';
        };
        button.onmouseout = () => {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)';
        };
        button.onclick = async function() {
            try {
                const newsData = await checkForNewNews();
                if (newsData) {
                    const existing = allNotifications.find(n => n.link === newsData.link);
                    newsData.sent = existing ? existing.sent : false;
                    if (!lastNewsLinks.includes(newsData.link)){
                        lastNewsLinks.push(newsData.link);
                        saveLastNewsLinks();
                        allNotifications.push(newsData);
                        saveAllNotifications();
                    }
                    createNotification(newsData);
                    button.innerHTML = '✓';
                    button.disabled = true;
                    button.style.background = 'linear-gradient(135deg, #00cc00, #009900)';
                    setTimeout(() => {
                        button.innerHTML = '🔄';
                        button.disabled = false;
                        button.style.background = 'linear-gradient(135deg, #4d79ff, #0033cc)';
                    }, 2000);
                } else {
                    button.innerHTML = '×';
                    button.disabled = true;
                    button.style.background = 'linear-gradient(135deg, #ff4d4d, #cc0000)';
                    setTimeout(() => {
                        button.innerHTML = '🔄';
                        button.disabled = false;
                        button.style.background = 'linear-gradient(135deg, #4d79ff, #0033cc)';
                    }, 2000);
                }
            } catch (error) {
                console.error('Ошибка при ручном показе уведомления:', error);
            }
        };
        document.body.appendChild(button);
    }

    // Функция для создания кнопки истории уведомлений
    function createHistoryButton() {
        const button = document.createElement('button');
        button.id = 'history-notifications-button';
        button.title = 'Показать историю уведомлений';
        button.innerHTML = '🔔';
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #a0a0a0, #808080);
            color: white;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            z-index: 9999;
            font-size: 20px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        button.onmouseover = () => {
            button.style.transform = 'scale(1.1)';
            button.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.2)';
        };
        button.onmouseout = () => {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)';
        };
        button.onclick = function() {
            const existingMenu = document.getElementById('history-menu');
            if (existingMenu) {
                existingMenu.remove();
            } else {
                createHistoryMenu();
            }
        };
        document.body.appendChild(button);
    }

    // Функция для создания меню истории
    function createHistoryMenu() {
        const overlay = document.createElement('div');
        overlay.id = 'history-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            backdrop-filter: blur(5px);
        `;
        overlay.onclick = function() {
            const menu = document.getElementById('history-menu');
            if (menu) menu.remove();
            overlay.remove();
        };
        document.body.appendChild(overlay);

        const menu = document.createElement('div');
        menu.id = 'history-menu';
        menu.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 800px;
            max-height: 80vh;
            background: linear-gradient(135deg, #f5f5f5, #e0e0e0);
            border: 1px solid #ccc;
            border-radius: 15px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 10001;
            padding: 20px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 14px;
        `;

        const title = document.createElement('h3');
        title.textContent = 'История уведомлений';
        title.style.cssText = `
            margin: 0 0 20px 0;
            color: #333;
            text-align: center;
        `;
        menu.appendChild(title);

        const scrollableContainer = document.createElement('div');
        scrollableContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            max-height: calc(80vh - 120px);
            overflow-y: auto;
            border-radius: 15px;
        `;

        if (allNotifications.length >= 5) {
            const notificationsContainer = document.createElement('div');
            notificationsContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                max-height: calc(80vh - 120px);
                background: linear-gradient(135deg, #f5f5f5, #e0e0e0);
                border-radius: 15px;
                padding: 10px;
            `;
            notificationsContainer.appendChild(scrollableContainer);
            menu.appendChild(notificationsContainer);
        } else {
            menu.appendChild(scrollableContainer);
        }

        const style = document.createElement('style');
        style.textContent = `
            #history-menu div::-webkit-scrollbar {
                display: none;
            }
        `;
        document.head.appendChild(style);

        allNotifications.slice().reverse().forEach((newsData, index) => {
            const { link, title, text, imageSrc, sent = false } = newsData;
            const hashtags = '\n\n#kod #itdkod\nСоздатели: 🤯@dmitrii_gr( #дым )  🕶@Artemius( #cakepopular )';
            const fullText = title + '\n\n' + text + hashtags;

            const notificationElement = document.createElement('div');
            notificationElement.className = 'notification-element';
            notificationElement.setAttribute('data-link', link);
            notificationElement.style.cssText = `
                background: linear-gradient(135deg, #4d79ff, #0033cc);
                color: white;
                padding: 20px;
                box-sizing: border-box;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 14px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1);
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-radius: 15px;
                margin-bottom: 10px;
                opacity: 0;
                transition: opacity 0.5s ease;
            `;

            const textContainer = document.createElement('div');
            textContainer.style.flex = '1';
            textContainer.style.marginRight = '20px';
            textContainer.innerHTML = `<strong style="font-weight: 600;">📰 НОВОСТЬ KOD.RU:</strong><br><a href="${link}" target="_blank" style="color: #ffe6e6; text-decoration: none; font-weight: 500;">${title}</a>`;

            const buttonsContainer = document.createElement('div');
            buttonsContainer.style.display = 'flex';
            buttonsContainer.style.gap = '10px';

            const copyButton = document.createElement('button');
            copyButton.textContent = 'КОПИРОВАТЬ';
            copyButton.style.cssText = `
                background-color: rgba(255,255,255,0.2);
                color: white;
                border: 1px solid rgba(255,255,255,0.3);
                padding: 10px 15px;
                cursor: pointer;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 500;
                transition: background-color 0.3s ease;
            `;
            copyButton.onmouseover = () => copyButton.style.backgroundColor = 'rgba(255,255,255,0.3)';
            copyButton.onmouseout = () => copyButton.style.backgroundColor = 'rgba(255,255,255,0.2)';
            copyButton.onclick = async function() {
                try {
                    await navigator.clipboard.writeText(fullText);
                    const originalText = copyButton.textContent;
                    copyButton.textContent = '✓';
                    copyButton.disabled = true;
                    copyButton.style.backgroundColor = 'rgba(0,255,0,0.3)';
                    setTimeout(() => {
                        copyButton.textContent = originalText;
                        copyButton.disabled = false;
                        copyButton.style.backgroundColor = 'rgba(255,255,255,0.2)';
                    }, 2000);
                } catch (error) {
                    console.error('Ошибка копирования:', error);
                }
            };

            const sendButton = document.createElement('button');
            sendButton.textContent = sent ? '✓' : 'ОТПРАВИТЬ НОВОСТЬ';
            sendButton.style.cssText = `
                background-color: ${sent ? 'rgba(0,255,0,0.3)' : 'rgba(255,255,255,0.2)'};
                color: white;
                border: 1px solid rgba(255,255,255,0.3);
                padding: 10px 15px;
                cursor: ${sent ? 'default' : 'pointer'};
                border-radius: 8px;
                font-size: 12px;
                font-weight: 500;
                transition: background-color 0.3s ease;
                text-align: center;
                min-width: 120px;
            `;
            if (!sent) {
                sendButton.onmouseover = () => sendButton.style.backgroundColor = 'rgba(255,255,255,0.3)';
                sendButton.onmouseout = () => sendButton.style.backgroundColor = 'rgba(255,255,255,0.2)';
            }
            sendButton.onclick = async function() {
                if (sent) return;
                if (typeof create_post === 'function') {
                    try {
                        const result = await create_post(fullText, imageSrc);
                        if (result && typeof result.then === 'function') {
                            await result;
                        } else if (result === false) {
                            throw new Error('Failed');
                        }
                        sendButton.textContent = '✓';
                        sendButton.disabled = true;
                        sendButton.style.cursor = 'default';
                        sendButton.style.backgroundColor = 'rgba(0,255,0,0.3)';
                        newsData.sent = true;
                        saveAllNotifications();
                        updateSendButtonsForLink(link);
                    } catch (error) {
                        console.error('Ошибка при вызове create_post:', error);
                        const originalText = sendButton.textContent;
                        sendButton.textContent = '×';
                        sendButton.disabled = true;
                        sendButton.style.backgroundColor = 'rgba(255,0,0,0.3)';
                        setTimeout(() => {
                            sendButton.textContent = originalText;
                            sendButton.disabled = false;
                            sendButton.style.backgroundColor = 'rgba(255,255,255,0.2)';
                        }, 2000);
                    }
                } else {
                    console.error('Функция create_post не найдена!');
                }
            };

            buttonsContainer.appendChild(copyButton);
            buttonsContainer.appendChild(sendButton);
            notificationElement.appendChild(textContainer);
            notificationElement.appendChild(buttonsContainer);
            scrollableContainer.appendChild(notificationElement);

            setTimeout(() => {
                notificationElement.style.opacity = '1';
            }, index * 200);
        });

        const closeButton = document.createElement('button');
        closeButton.textContent = '✕';
        closeButton.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: #ccc;
            border: none;
            border-radius: 5px;
            padding: 5px 10px;
            cursor: pointer;
        `;
        closeButton.onclick = function() {
            const menu = document.getElementById('history-menu');
            if (menu) menu.remove();
            overlay.remove();
            if (style.parentNode) style.parentNode.removeChild(style);
        };
        menu.appendChild(closeButton);

        document.body.appendChild(menu);
    }

    // Асинхронная функция для обработки проверки
    async function performCheck() {
        try {
            const newsData = await checkForNewNews();
            if (newsData && !lastNewsLinks.includes(newsData.link)) {
                lastNewsLinks.push(newsData.link);
                saveLastNewsLinks();
                const existing = allNotifications.find(n => n.link === newsData.link);
                newsData.sent = existing ? existing.sent : false;
                allNotifications.push(newsData);
                saveAllNotifications();
                createNotification(newsData);
            }
        } catch (error) {
            console.error('Ошибка при проверке новостей:', error);
        }
    }

    function create_post(text, imageSrc) {
        // Возвращаем всю цепочку, чтобы вызывающий код мог знать о результате
        return fetch('/api/v1/auth/refresh', { method: 'POST' })
            .then(resRefresh => {
            // Проверяем первый запрос
            if (!resRefresh.ok) {
                console.error(`Refresh failed with status ${resRefresh.status}`);
                return resRefresh.text().then(text => console.error('Refresh response:', text)).then(() => { throw new Error('Refresh failed'); });
            }
            return resRefresh.json(); // Возвращаем Promise с данными
        })
            .then(data => {
            const accessToken = data.accessToken;

            let attachmentIds = [];

            // Если есть изображение, загружаем его
            if (imageSrc) {
                return fetch(imageSrc)
                    .then(res => {
                        if (!res.ok) throw new Error('Failed to fetch image');
                        return res.blob();
                    })
                    .then(blob => {
                        console.log('Original blob size:', blob.size, 'type:', blob.type);
                        // Конвертируем в PNG
                        return new Promise((resolve, reject) => {
                            const img = new Image();
                            img.onload = () => {
                                const canvas = document.createElement('canvas');
                                const ctx = canvas.getContext('2d');
                                canvas.width = img.width;
                                canvas.height = img.height;
                                ctx.drawImage(img, 0, 0);
                                canvas.toBlob(resolve, 'image/png');
                            };
                            img.onerror = reject;
                            img.src = URL.createObjectURL(blob);
                        });
                    })
                    .then(convertedBlob => {
                        console.log('Converted blob size:', convertedBlob.size, 'type:', convertedBlob.type);
                        const formData = new FormData();
                        formData.append('file', convertedBlob);
                        return fetch('/api/files/upload', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`
                            },
                            body: formData
                        });
                    })
                    .then(resUpload => {
                        if (resUpload.status !== 201) {
                            console.error(`Upload failed with status ${resUpload.status}`);
                            return resUpload.text().then(text => console.error('Upload response:', text)).then(() => { throw new Error('Upload failed'); });
                        }
                        return resUpload.json();
                    })
                    .then(uploadData => {
                        attachmentIds = [uploadData.id];
                        // Теперь отправляем пост
                        return fetch('/api/posts', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${accessToken}`
                            },
                            body: JSON.stringify({ content: text, attachmentIds })
                        });
                    });
            } else {
                // Отправляем пост без изображения
                return fetch('/api/posts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({ content: text })
                });
            }
        })
            .then(resPost => {
            // Проверяем запрос на пост
            if (resPost.status !== 200 && resPost.status !== 201) {
                console.error(`Post failed with status ${resPost.status}`);
                return resPost.text().then(text => console.error('Post response:', text)).then(() => false);
            }
            console.log('Post created successfully');
            return true;
        })
            .catch(error => {
            // Сюда попадем при любой ошибке в цепочке или сетевом сбое
            console.error('Error in create_post:', error.message);
            return false;
        });
    }

    createManualButton();
    createHistoryButton();

    // Запускаем проверку сразу при загрузке страницы
    performCheck();

    // Периодическая проверка каждые 5 секунд
    setInterval(performCheck, 5000);
})();
