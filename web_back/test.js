const BASE_URL = "http://127.0.0.1:8080"; // Адрес вашего backend

const wrapper = document.querySelector('.wrapper');
const btnPopup = document.querySelector('.btnLogin-popup');
const closePopup = document.getElementById('close-popup');
const addTestBtn = document.getElementById('addTestBtn');
const addTestPopup = document.getElementById('addTestPopup');
const questionsContainer = document.getElementById('questionsContainer');
const addQuestionBtn = document.getElementById('addQuestionBtn');
const addTestForm = document.getElementById('addTestForm');
const editTestBtn = document.getElementById('editTestBtn');
const editTestPopup = document.getElementById('editTestPopup');
const editQuestionsContainer = document.getElementById('editQuestionsContainer');
const editTestForm = document.getElementById('editTestForm');

let tests = []; // Массив для хранения тестов

// Открытие попапа для логина
btnPopup.addEventListener('click', () => { 
    wrapper.classList.add('active-popup');
});

// Закрытие попапа для логина
closePopup.addEventListener('click', () => {
    wrapper.classList.add('close-popup');
    setTimeout(() => {
        wrapper.classList.remove('active-popup', 'close-popup');
    }, 500); 
});

// Открытие попапа добавления теста
addTestBtn.addEventListener('click', () => {
    addTestPopup.style.display = 'flex';
});

// Закрытие попапа добавления теста
document.getElementById('close-add-popup').addEventListener('click', () => {
    addTestPopup.style.display = 'none';
    questionsContainer.innerHTML = ''; // Очищаем вопросы при закрытии
});

// Добавление нового вопроса
addQuestionBtn.addEventListener('click', () => {
    const questionBlock = document.createElement('div');
    questionBlock.classList.add('question-block');
    questionBlock.innerHTML = `
        <input type="text" class="question" placeholder="Вопрос" required>
        <div class="answers">
            <input type="text" class="answer" placeholder="Вариант A" required>
            <input type="text" class="answer" placeholder="Вариант B" required>
            <input type="text" class="answer" placeholder="Вариант C" required>
            <input type="text" class="answer" placeholder="Вариант D" required>
        </div>
        <select class="correct-answer" required>
            <option value="" disabled selected>Выберите правильный ответ</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
        </select>
        <button type="button" class="removeQuestionBtn">Удалить вопрос</ button>
    `;
    questionsContainer.appendChild(questionBlock);

    // Удаление вопроса
    questionBlock.querySelector('.removeQuestionBtn').addEventListener('click', () => {
        questionsContainer.removeChild(questionBlock);
    });
});

// Функция генерации UUID
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Сохранение теста
addTestForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const testTitle = document.getElementById('testTitle').value;
    const questionBlocks = questionsContainer.querySelectorAll('.question-block');
    const questions = Array.from(questionBlocks).map(block => ({
        question: block.querySelector('.question').value,
        answers: Array.from(block.querySelectorAll('.answer')).map(input => input.value),
        correct_answer: block.querySelector('.correct-answer').value
    }));

    const test = {
        id: uuidv4(), // Генерация уникального ID
        title: testTitle,
        questions: questions
    };

    try {
        const response = await fetch(`${BASE_URL}/tests`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(test)
        });

        if (response.ok) {
            const result = await response.json();
            alert(result.message || 'Тест успешно добавлен!');
            tests.push(test); // Обновляем локальный массив
        } else {
            const error = await response.json();
            console.error('Ошибка при добавлении теста:', error.detail || 'Неизвестная ошибка');
            alert('Ошибка при добавлении теста!');
        }
    } catch (error) {
        console.error('Ошибка при добавлении теста:', error);
        alert('Не удалось отправить тест на сервер. Проверьте соединение.');
    }

    addTestPopup.style.display = 'none';
    addTestForm.reset();
    questionsContainer.innerHTML = '';
});

// Открытие попапа редактирования теста
editTestBtn.addEventListener('click', () => {
    populateTestSelect();
    document.getElementById('editTestPopup').style.display = 'flex';
});

// Закрытие попапа редактирования теста
document.getElementById('close-edit-popup').addEventListener('click', () => {
    document.getElementById('editTestPopup').style.display = 'none';
    editQuestionsContainer.innerHTML = ''; // Очищаем вопросы при закрытии
});

// Заполнение выпадающего списка тестов
function populateTestSelect() {
    const testSelect = document.getElementById('testSelect');
    testSelect.innerHTML = '<option value="">Выберите тест</option>'; // Сброс списка
    tests.forEach((test, index) => {
        const option = document.createElement('option');
        option.value = index; // Используем индекс для идентификации теста
        option.textContent = test.title;
        testSelect.appendChild(option);
    });
}

// Загрузка теста для редактирования
function loadTest() {
    const testSelect = document.getElementById('testSelect');
    const selectedIndex = testSelect.value;
    editQuestionsContainer.innerHTML = ''; // Очищаем предыдущие вопросы

    if (selectedIndex !== "") {
        const test = tests[selectedIndex];
        test.questions.forEach((question, qIndex) => {
            const questionBlock = document.createElement('div');
            questionBlock.classList.add('question-block');
            question
            questionBlock.innerHTML = `
                <input type="text" class="question" value="${question.question}" required>
                <div class="answers">
                    ${question.answers.map((answer, aIndex) => `
                        <input type="text" class="answer" value="${answer}" required>
                    `).join('')}
                </div>
                <select class="correct-answer" required>
                    <option value="" disabled>Выберите правильный ответ</option>
                    <option value="A" ${question.correctAnswer === 'A' ? 'selected' : ''}>A</option>
                    <option value="B" ${question.correctAnswer === 'B' ? 'selected' : ''}>B</option>
                    <option value="C" ${question.correctAnswer === 'C' ? 'selected' : ''}>C</option>
                    <option value="D" ${question.correctAnswer === 'D' ? 'selected' : ''}>D</option>
                </select>
                <button type="button" class="removeQuestionBtn">Удалить вопрос</button>
            `;
            editQuestionsContainer.appendChild(questionBlock);

            // Удаление вопроса
            questionBlock.querySelector('.removeQuestionBtn').addEventListener('click', () => {
                editQuestionsContainer.removeChild(questionBlock);
            });
        });
    }
}

// Добавление нового вопроса в редактируемый тест
document.getElementById('addEditQuestionBtn').addEventListener('click', () => {
    const questionBlock = document.createElement('div');
    questionBlock.classList.add('question-block');
    questionBlock.innerHTML = `
        <input type="text" class="question" placeholder="Вопрос" required>
        <div class="answers">
            <input type="text" class="answer" placeholder="Вариант A" required>
            <input type="text" class="answer" placeholder="Вариант B" required>
            <input type="text" class="answer" placeholder="Вариант C" required>
            <input type="text" class="answer" placeholder="Вариант D" required>
        </div>
        <select class="correct-answer" required>
            <option value="" disabled selected>Выберите правильный ответ</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
        </select>
        <button type="button" class="removeQuestionBtn">Удалить вопрос</button>
    `;
    editQuestionsContainer.appendChild(questionBlock);

    // Удаление вопроса
    questionBlock.querySelector('.removeQuestionBtn').addEventListener('click', () => {
        editQuestionsContainer.removeChild(questionBlock);
    });
});

// Сохранение изменений теста
document.getElementById('saveEditTestBtn').addEventListener('click', () => {
    const testSelect = document.getElementById('testSelect');
    const selectedIndex = testSelect.value;

    if (selectedIndex !== "") {
        const test = tests[selectedIndex];
        const questionBlocks = editQuestionsContainer.querySelectorAll('.question-block');
        const questions = [];

        questionBlocks.forEach(block => {
            const questionText = block.querySelector('.question').value;
            const answers = Array.from(block.querySelectorAll('.answer')).map(input => input.value);
            const correctAnswer = block.querySelector('.correct-answer').value;
            questions.push({ question: questionText, answers, correctAnswer });
        });

        tests[selectedIndex].questions = questions; // Обновляем вопросы теста
        alert('Изменения сохранены!');
        document.getElementById('editTestPopup').style.display = 'none';
        editQuestionsContainer.innerHTML = ''; // Очищаем контейнер вопросов
    } else {
        alert('Пожалуйста, выберите тест для редактирования.');
    }
});
// Открытие попапа "Мои Тесты"
document.getElementById('myTestsBtn').addEventListener('click', () => {
    displayTests();
    document.getElementById('myTestsPopup').style.display = 'flex';
});

// Закрытие попапа "Мои Тесты"
document.getElementById('close-my-tests-popup').addEventListener('click', () => {
    document.getElementById('myTestsPopup').style.display = 'none';
});

// Функция для отображения тестов
async function fetchTests() {
    try {
        const response = await fetch(`${BASE_URL}/tests`);
        tests = await response.json(); // Сохраняем тесты в локальный массив
        displayTests(); // Вызываем обновление списка тестов
    } catch (error) {
        console.error("Ошибка при получении тестов:", error);
    }
}

// Обновление списка тестов
function displayTests() {
    const testList = document.getElementById('testList');
    testList.innerHTML = ''; // Очистка списка

    tests.forEach((test, index) => {
        const li = document.createElement('li');
        li.textContent = test.title;

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Удалить';
        deleteButton.onclick = async () => {
            try {
                const response = await fetch(`${BASE_URL}/tests/${test.id}`, {
                    method: "DELETE",
                });
                if (response.ok) {
                    tests.splice(index, 1); // Удаляем тест из массива
                    displayTests(); // Обновляем список
                } else {
                    console.error("Ошибка при удалении теста:", await response.text());
                }
            } catch (error) {
                console.error("Ошибка при удалении теста:", error);
            }
        };

        const takeButton = document.createElement('button');
        takeButton.textContent = 'Пройти';
        takeButton.onclick = () => {
            takeTest(index); // Логика прохождения теста остаётся без изменений
        };

        li.appendChild(deleteButton);
        li.appendChild(takeButton);
        testList.appendChild(li);
    });
}

// Загрузка тестов при старте страницы
window.onload = fetchTests;

// Функция для прохождения теста
function takeTest(testIndex) {
    const test = tests[testIndex];
    let score = 0;

    test.questions.forEach((question) => {
        const userAnswer = prompt(`${question.question}\n${question.answers.join('\n')}`);
        if (userAnswer === question.correctAnswer) {
            score += 1; // Увеличиваем счет за правильный ответ
        }
    });

    alert(`Вы прошли тест "${test.title}" и получили ${score} баллов из ${test.questions.length}!`);
}
// Открытие попапа для прохождения теста
function takeTest(testIndex) {
    const test = tests[testIndex];
    document.getElementById('testTitlePopup').textContent = test.title;
    const testQuestionsContainer = document.getElementById('testQuestionsContainer');
    testQuestionsContainer.innerHTML = ''; // Очистка контейнера вопросов

    test.questions.forEach((question, qIndex) => {
        const questionBlock = document.createElement('div');
        questionBlock.classList.add('question-block');
        questionBlock.innerHTML = `
            <p>${qIndex + 1}. ${question.question}</p>
            <div class="answers">
                <label><input type="radio" name="question${qIndex}" value="A"> ${question.answers[0]}</label><br>
                <label><input type="radio" name="question${qIndex}" value="B"> ${question.answers[1]}</label><br>
                <label><input type="radio" name="question${qIndex}" value="C"> ${question.answers[2]}</label><br>
                <label><input type="radio" name="question${qIndex}" value="D"> ${question.answers[3]}</label>
            </div>
        `;
        testQuestionsContainer.appendChild(questionBlock);
    });

    document.getElementById('testPopup').style.display = 'flex';

    // Обработка отправки теста
    document.getElementById('submitTestBtn').onclick = () => {
        let score = 0;
        test.questions.forEach((question, qIndex) => {
            const selectedAnswer = document.querySelector(`input[name="question${qIndex}"]:checked`);
            if (selectedAnswer && selectedAnswer.value === question.correctAnswer) {
                score += 100 / test.questions.length; // Увеличиваем счет на 100/количество вопросов
            }
        });

        alert(`Вы прошли тест "${test.title}" и получили ${score.toFixed(2)} баллов из 100!`);
        document.getElementById('testPopup').style.display = 'none'; // Закрытие попапа
    };
}

// Закрытие попапа теста
document.getElementById('close-test-popup').addEventListener('click', () => {
    document.getElementById('testPopup').style.display = 'none';
});
// Открытие попапа для прохождения теста
function takeTest(testIndex) {
    const test = tests[testIndex];
    document.getElementById('testTitlePopup').textContent = test.title;
    const testQuestionsContainer = document.getElementById('testQuestionsContainer');
    testQuestionsContainer.innerHTML = ''; // Очистка контейнера вопросов

    test.questions.forEach((question, qIndex) => {
        const questionBlock = document.createElement('div');
        questionBlock.classList.add('question-block');
        questionBlock.innerHTML = `
            <p>${qIndex + 1}. ${question.question}</p>
            <div class="answers">
                <label><input type="radio" name="question${qIndex}" value="A"> ${question.answers[0]}</label><br>
                <label><input type="radio" name="question${qIndex}" value="B"> ${question.answers[1]}</label><br>
                <label><input type="radio" name="question${qIndex}" value="C"> ${question.answers[2]}</label><br>
                <label><input type="radio" name="question${qIndex}" value="D"> ${question.answers[3]}</label>
            </div>
        `;
        testQuestionsContainer.appendChild(questionBlock);
    });

    document.getElementById('testPopup').style.display = 'flex';

// Обработка отправки теста
    document.getElementById('submitTestBtn').onclick = () => {
        let score = 0;
        test.questions.forEach((question, qIndex) => {
            const selectedAnswer = document.querySelector(`input[name="question${qIndex}"]:checked`);
            if (selectedAnswer && selectedAnswer.value === question.correctAnswer) {
                score += 100 / test.questions.length; // Увеличиваем счет на 100/количество вопросов
            }
        });

// Отображение результата в новом попапе
        document.getElementById('resultMessage').textContent = `Вы прошли тест "${test.title}" и получили ${score.toFixed(2)} баллов из 100!`;
        document.getElementById('resultPopup').style.display = 'flex';
        document.getElementById('testPopup').style.display = 'none'; // Закрытие попапа теста
    };
}
// Добавляем обработчик события на изменение радио кнопок
test.questions.forEach((question, qIndex) => {
    const radioButtons = document.querySelectorAll(`input[name="question${qIndex}"]`);
    radioButtons.forEach(button => {
        button.addEventListener('change', () => {
            // Обновляем результат после каждого изменения ответа
            let score = 0;
            test.questions.forEach((question, qIndex) => {
                const selectedAnswer = document.querySelector(`input[name="question${qIndex}"]:checked`);
                if (selectedAnswer && selectedAnswer.value === question.correctAnswer) {
                    score += 100 / test.questions.length; // Увеличиваем счет на 100/количество вопросов
                }
            });
            document.getElementById('resultMessage').textContent = `Вы прошли тест "${test.title}" и получили ${score.toFixed(2)} баллов из 100!`;
        });
    });
});
// Открытие попапа для поиска тестов
document.getElementById('searchTestsBtn').addEventListener('click', () => {
    document.getElementById('searchTestsPopup').style.display = 'flex';
});

// Закрытие попапа поиска тестов
document.getElementById('close-search-tests-popup').addEventListener('click', () => {
    document.getElementById('searchTestsPopup').style.display = 'none';
});

// Поиск тестов
document.getElementById('searchBtn').addEventListener('click', () => {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const searchResults = tests.filter(test => test.title.toLowerCase().includes(searchTerm));
    displaySearchResults(searchResults);
});

// Функция для отображения результатов поиска
function displaySearchResults(results) {
    const searchResultsList = document.getElementById('searchResultsList');
    searchResultsList.innerHTML = ''; // Очистка списка результатов

    if (results.length === 0) {
        searchResultsList.innerHTML = '<li style="color: white;">Тесты не найдены.</li>'; // Устанавливаем цвет текста в белый
    } else {
        results.forEach((test, index) => {
            const li = document.createElement('li');
            
            // Создаем контейнер для названия теста и кнопки
            const testContainer = document.createElement('div');
            testContainer.style.display = 'flex'; // Используем flexbox для выравнивания
            
            // Название теста
            const testTitle = document.createElement('span');
            testTitle.textContent = test.title;
            testTitle.style.marginRight = '10px'; // Отступ между названием и кнопкой
            testTitle.style.color = 'white'; // Устанавливаем цвет текста в белый
            
            // Кнопка "Пройти"
            const takeButton = document.createElement('button');
            takeButton.textContent = 'Пройти';
            takeButton.onclick = () => {
                takeTest(tests.indexOf(test)); // Функция для прохождения теста
            };

            // Добавляем название теста и кнопку в контейнер
            testContainer.appendChild(testTitle);
            testContainer.appendChild(takeButton);
            li.appendChild(testContainer); // Добавляем контейнер в элемент списка
            
            searchResultsList.appendChild(li);
        });
    }

    // Закрываем попап поиска и открываем попап с результатами
    document.getElementById('searchTestsPopup').style.display = 'none';
    document.getElementById('searchResultsPopup').style.display = 'flex'; // Открытие попапа с результатами
}

// Закрытие попапа результатов поиска
document.getElementById('close-search-results-popup').addEventListener('click', () => {
    document.getElementById('searchResultsPopup').style.display = 'none';
});
// Закрытие попапа результата
document.getElementById('close-result-popup').addEventListener('click', () => {
    document.getElementById('resultPopup').style.display = 'none';
});
