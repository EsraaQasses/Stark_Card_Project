module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            // explicit plugin for reanimated to ensure no issues in production
            'react-native-reanimated/plugin',
        ],
    };
};
