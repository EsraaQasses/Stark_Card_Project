// src/screens/WalletQR.js
import React from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import Screenn from "../ui/Screenn";
import appTheme from "../ui/Theme";
import { useScale } from "../ui/scale";
import { useAuth } from "../context/AuthProvider";

const { colors } = appTheme;

export default function WalletQR({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { sx, sy } = useScale();
    const { user } = useAuth();

    // الحصول على معلومات المحفظة من route params
    const currency = route?.params?.currency || "USD";
    const walletAddress = route?.params?.walletAddress || user?.id || "N/A";

    // بيانات QR - يمكن تخصيصها حسب الحاجة
    const qrData = JSON.stringify({
        type: "transfer",
        userId: user?.id,
        username: user?.name,
        phone: user?.phone || null,
        currency: currency,
        walletAddress: walletAddress,
    });

    const handleShare = async () => {
        try {
            await Share.share({
                message: `My ${currency} Wallet Address: ${walletAddress}`,
                title: "Share Wallet Address",
            });
        } catch (error) {
            console.error("Error sharing:", error);
        }
    };

    return (
        <Screenn bgColor="#fff" useDefaultBg={false}>
            <View style={{ flex: 1, paddingTop: insets.top + sy(20) }}>
                {/* Header */}
                <View style={{ paddingHorizontal: sx(14), marginBottom: sy(30) }}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                    >
                        <Text style={styles.backIcon}>←</Text>
                    </TouchableOpacity>
                    <Text style={[styles.title, { fontSize: sx(28) }]}>
                        {currency} Wallet QR
                    </Text>
                    <Text style={[styles.subtitle, { fontSize: sx(14) }]}>
                        Scan to receive {currency}
                    </Text>
                </View>

                {/* QR Code Container */}
                <View style={styles.qrContainer}>
                    <View
                        style={[
                            styles.qrWrapper,
                            { borderRadius: sx(24), padding: sy(24) },
                        ]}
                    >
                        <QRCode value={qrData} size={sx(250)} />
                    </View>

                    {/* Wallet Info */}
                    <View style={{ marginTop: sy(24), paddingHorizontal: sx(24) }}>
                        <Text style={[styles.label, { fontSize: sx(12) }]}>
                            Wallet Address
                        </Text>
                        <View
                            style={[
                                styles.addressContainer,
                                { borderRadius: sx(12), padding: sy(12) },
                            ]}
                        >
                            <Text style={[styles.address, { fontSize: sx(14) }]}>
                                {walletAddress}
                            </Text>
                        </View>
                    </View>

                    {/* Share Button */}
                    <TouchableOpacity
                        style={[
                            styles.shareButton,
                            { borderRadius: sx(12), marginTop: sy(24) },
                        ]}
                        onPress={handleShare}
                    >
                        <Text style={[styles.shareButtonText, { fontSize: sx(16) }]}>
                            Share Wallet Address
                        </Text>
                    </TouchableOpacity>

                    {/* Info Text */}
                    <Text style={[styles.infoText, { fontSize: sx(12), marginTop: sy(16) }]}>
                        Share this QR code with others to receive {currency} payments
                    </Text>
                </View>
            </View>
        </Screenn>
    );
}

const styles = StyleSheet.create({
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#F8FAFC",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    backIcon: {
        fontSize: 24,
        color: "#0E1B3B",
    },
    title: {
        fontWeight: "800",
        color: "#0E1B3B",
        marginBottom: 4,
    },
    subtitle: {
        color: "#7C8DA6",
        fontWeight: "500",
    },
    qrContainer: {
        flex: 1,
        alignItems: "center",
        paddingHorizontal: 24,
    },
    qrWrapper: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: colors.line,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    label: {
        color: "#7C8DA6",
        fontWeight: "600",
        marginBottom: 8,
        textAlign: "center",
    },
    addressContainer: {
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: colors.line,
    },
    address: {
        color: "#0E1B3B",
        fontWeight: "700",
        textAlign: "center",
    },
    shareButton: {
        backgroundColor: "#0B63D8",
        paddingVertical: 14,
        paddingHorizontal: 32,
        alignSelf: "stretch",
        marginHorizontal: 24,
    },
    shareButtonText: {
        color: "#FFFFFF",
        fontWeight: "700",
        textAlign: "center",
    },
    infoText: {
        color: "#7C8DA6",
        textAlign: "center",
        paddingHorizontal: 32,
    },
});
