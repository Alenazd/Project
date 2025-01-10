cmake_minimum_required(VERSION 3.10)
project(AlgProjectPol)

# Настройка vcpkg
set(CMAKE_TOOLCHAIN_FILE "${CMAKE_CURRENT_SOURCE_DIR}/tgbot/vcpkg/scripts/buildsystems/vcpkg.cmake")

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Отключаем предупреждения о политиках
cmake_policy(SET CMP0074 NEW)
cmake_policy(SET CMP0144 NEW)

# Set output directories
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)

# Add subdirectories
add_subdirectory(tgbot)

# Find required packages
find_package(CURL REQUIRED)
find_package(hiredis REQUIRED)
find_package(jsoncpp REQUIRED)
find_package(GTest REQUIRED)
find_package(nlohmann_json REQUIRED)

# Add executable
add_executable(telegram_bot
    tgbot/main.cpp
    tgbot/bot_logic.cpp
    tgbot/redis_client.cpp
)

# Include directories
target_include_directories(telegram_bot PRIVATE
    ${CMAKE_SOURCE_DIR}/tgbot
    ${CURL_INCLUDE_DIRS}
    ${HIREDIS_INCLUDE_DIRS}
    ${JSONCPP_INCLUDE_DIRS}
)

# Link libraries
target_link_libraries(telegram_bot PRIVATE
    ${CURL_LIBRARIES}
    hiredis
    jsoncpp
    nlohmann_json::nlohmann_json
    GTest::GTest
    GTest::Main
)

# Add tests
enable_testing()
add_executable(tests
    tests/test_bot_logic.cpp
    tests/test_redis_client.cpp
    tgbot/bot_logic.cpp
    tgbot/redis_client.cpp
)

target_include_directories(tests PRIVATE
    ${CMAKE_SOURCE_DIR}/tgbot
    ${CURL_INCLUDE_DIRS}
    ${HIREDIS_INCLUDE_DIRS}
    ${JSONCPP_INCLUDE_DIRS}
)

target_link_libraries(tests PRIVATE
    ${CURL_LIBRARIES}
    hiredis
    jsoncpp
    nlohmann_json::nlohmann_json
    GTest::GTest
    GTest::Main
)

add_test(NAME unit_tests COMMAND tests)
