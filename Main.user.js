// ==UserScript==
// @name         KOD Durova News Monitor
// @namespace    https://github.com/Dima-programmer/Tampermonkey_ITD_AUTO_NEWS
// @updateURL    https://github.com/Dima-programmer/Tampermonkey_ITD_AUTO_NEWS/raw/refs/heads/main/Main.user.js
// @downloadURL  https://github.com/Dima-programmer/Tampermonkey_ITD_AUTO_NEWS/raw/refs/heads/main/Main.user.js
// @version      2.6
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

    lastNewsLinks = JSON.parse(localStorage.getItem('lastNewsLinks')) || lastNewsLinks || [];
    function saveLastNewsLinks() {
        localStorage.setItem('lastNewsLinks', JSON.stringify(lastNewsLinks));
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

        return { title, text };
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
                                        const { title, text } = parseNewsContentFromHTML(newsHtml);
                                        resolve({ link, title, text });
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

    // Функция для создания уведомления
    function createNotification(newsData) {
        const { link, title, text } = newsData;
        const hashtags = '\n\n#kod #itdkod\n#КААЛИЦИЯ #дым #potatopopular #potatosk #cakepopular #считаемманулов #тортодым #бобр #NewsOfficial\nЛюбимая #КААЛИЦИЯ: 🥴@kamra 👾@zzzuuuk 📰@newsoffc 🦦@BABRIK 🖕@Feihuya77 🕶@Artemius  🤯@dmitrii_gr 🤠@l1kaa11 🥴@skorlange';
        const fullText = title + '\n\n' + text + hashtags;

        // Создаем контейнер уведомления
        const notification = document.createElement('div');
        notification.id = 'tass-notification';
        notification.style.cssText = `
            position: fixed;
            left: 5%;
            width: 90%;
            max-width: 800px;
            background: linear-gradient(135deg, #ff4d4d, #cc0000); /* Современный градиент */
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
            border-radius: 15px; /* Более закругленные края */
            transform: translateY(-120%); /* Начальная позиция для анимации */
            transition: top 0.6s ease, transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.6s ease; /* Плавная анимация для top, transform и opacity */
            backdrop-filter: blur(10px); /* Современный эффект размытия */
            opacity: 1;
    `;

        // Контейнер для текста
        const textContainer = document.createElement('div');
        textContainer.style.flex = '1';
        textContainer.style.marginRight = '20px';
        textContainer.innerHTML = `<strong style="font-weight: 600;">📰 НОВОСТЬ KOD.RU:</strong><br><a href="${link}" target="_blank" style="color: #ffe6e6; text-decoration: none; font-weight: 500;">${title}</a>`;
        // Кнопки
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.gap = '10px';

        // Кнопка копирования
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

        // Кнопка отправки
        const sendButton = document.createElement('button');
        sendButton.textContent = 'ОТПРАВИТЬ НОВОСТЬ';
        sendButton.style.cssText = `
            background-color: rgba(255,255,255,0.2);
            color: white;
            border: 1px solid rgba(255,255,255,0.3);
            padding: 10px 15px;
            cursor: pointer;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 500;
            transition: background-color 0.3s ease;
            text-align: center; /* Центрирование текста */
            min-width: 120px; /* Фиксированная минимальная ширина для сохранения размера */
    `;
        sendButton.onmouseover = () => sendButton.style.backgroundColor = 'rgba(255,255,255,0.3)';
        sendButton.onmouseout = () => sendButton.style.backgroundColor = 'rgba(255,255,255,0.2)';
        sendButton.onclick = async function() {
            if (typeof create_post === 'function') {
                try {
                    const result = create_post(fullText);
                    if (result && typeof result.then === 'function') {
                        await result; // Асинхронный случай
                    } else if (result === false) {
                        throw new Error('Failed'); // Синхронный неудача
                    }
                    // Успех
                    sendButton.textContent = '✓';
                    sendButton.disabled = true;
                    sendButton.style.cursor = 'default';
                    sendButton.style.backgroundColor = 'rgba(0,255,0,0.3)';
                    // Уведомление остается открытым 3 сек
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.remove();
                        }
                    }, 2000);
                } catch (error) {
                    // Неудача
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

        // Функция для удаления уведомления с анимацией
        function removeNotification() {
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
            }, 600); // Время анимации
        }

        // Крестик для закрытия
        const closeButton = document.createElement('span');
        closeButton.textContent = '✕';
        closeButton.title = 'Закрыть'; // Подсказка для доступности
        closeButton.style.cssText = `
            font-size: 20px;
            cursor: pointer;
            color: white;
            margin-left: 10px;
            transition: color 0.3s ease;
    `;
        closeButton.onmouseover = () => closeButton.style.color = '#ffe6e6';
        closeButton.onmouseout = () => closeButton.style.color = 'white';
        closeButton.onclick = removeNotification;

        // Собираем элементы
        buttonsContainer.appendChild(copyButton);
        buttonsContainer.appendChild(sendButton);
        notification.appendChild(textContainer);
        notification.appendChild(buttonsContainer);
        notification.appendChild(closeButton);

        // Добавляем в body
        document.body.appendChild(notification);

        // Добавляем в начало массива активных уведомлений (новые сверху)
        activeNotifications.unshift(notification);

        // Обновляем позиции всех уведомлений
        updateNotificationPositions();

        // Анимация появления: дернуться, а потом выскочить
        setTimeout(() => {
            notification.style.transform = 'translateY(-100%)'; // Дернуться
        }, 10);
        setTimeout(() => {
            notification.style.transform = 'translateY(0)'; // Выскочить
        }, 150);
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
        button.innerHTML = '🔄'; // Иконка повтора
        button.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #4d79ff, #0033cc); /* Синий градиент, отличный от красного уведомлений */
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
                    if (!lastNewsLinks.includes(newsData.link)){
                        lastNewsLinks.push(newsData.link);
                        saveLastNewsLinks();
                    }
                    createNotification(newsData);
                    // Успех: временно меняем иконку
                    button.innerHTML = '✓';
                    button.disabled = true;
                    button.style.background = 'linear-gradient(135deg, #00cc00, #009900)';
                    setTimeout(() => {
                        button.innerHTML = '🔄';
                        button.disabled = false;
                        button.style.background = 'linear-gradient(135deg, #4d79ff, #0033cc)';
                    }, 2000);
                } else {
                    // Нет новости
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

    // Асинхронная функция для обработки проверки
    async function performCheck() {
        try {
            const newsData = await checkForNewNews();
            if (newsData && !lastNewsLinks.includes(newsData.link)) {
                lastNewsLinks.push(newsData.link);
                saveLastNewsLinks();
                createNotification(newsData);
            }
        } catch (error) {
            console.error('Ошибка при проверке новостей:', error);
        }
    }

    function create_post(text) {
        // Возвращаем всю цепочку, чтобы вызывающий код мог знать о результате
        return fetch('/api/v1/auth/refresh', { method: 'POST' })
            .then(resRefresh => {
            // Проверяем первый запрос
            if (!resRefresh.ok) {
                console.error(`Refresh failed with status ${resRefresh.status}`);
                throw new Error('Refresh failed'); // Прерываем цепочку и идем в .catch
            }
            return resRefresh.json(); // Возвращаем Promise с данными
        })
            .then(data => {
            const accessToken = data.accessToken;

            // Отправляем второй запрос, используя данные первого
            return fetch('/api/posts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({ content: text })
            });
        })
            .then(resPost => {
            // Проверяем второй запрос
            if (resPost.status !== 200 && resPost.status !== 201) {
                console.error(`Post failed with status ${resPost.status}`);
                return false;
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

    // Запускаем проверку сразу при загрузке страницы
    performCheck();

    // Периодическая проверка каждые 5 секунд
    setInterval(performCheck, 5000);
})();
