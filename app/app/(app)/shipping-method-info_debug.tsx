
// This is a minimal debug version of ShippingMethodInfo
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function ShippingMethodInfoScreen() {
    const params = useLocalSearchParams();
    console.log("[ShippingMethodInfoScreen] RENDER DEBUG. Params:", params);

    return (
        <View style={styles.container}>
            <Text style={styles.text}>SHIPPING METHOD INFO DEBUG</Text>
            <Text style={styles.text}>Params: {JSON.stringify(params)}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'red', // Bright red to verify visibility
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 100,
    },
    text: {
        fontSize: 20,
        color: 'white',
        fontWeight: 'bold',
        marginBottom: 20,
    }
});
