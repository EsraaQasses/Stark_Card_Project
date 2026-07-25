// src/screens/Downloads.js
import React from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
} from "react-native";
import Screenn from "../ui/Screenn";
import NavBar from "../ui/NavBar";
import { useScale } from "../ui/scale";
import { AppHeader } from "../shared/ui/layout";
import { AppCard, AppEmptyState } from "../shared/ui/primitives";
import {
    colors,
    fontFamilies,
    radius,
    shadows,
    spacing,
    typography,
} from "../shared/theme";

export default function Downloads({ navigation }) {
    const { sx, sy } = useScale();

    // Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„ØªÙ†Ø²ÙŠÙ„Ø§Øª - ÙŠÙ…ÙƒÙ† Ø±Ø¨Ø·Ù‡Ø§ Ø¨Ù€ API Ù„Ø§Ø­Ù‚Ø§Ù‹
    const downloads = [
        {
            id: "1",
            name: "Invoice_2024_001.pdf",
            size: "2.5 MB",
            date: "2024-12-09",
            type: "pdf",
        },
        {
            id: "2",
            name: "Receipt_Payment.pdf",
            size: "1.2 MB",
            date: "2024-12-08",
            type: "pdf",
        },
    ];

    const renderDownloadItem = ({ item }) => (
        <TouchableOpacity activeOpacity={0.82}>
            <AppCard style={styles.downloadItem}>
            <View style={styles.iconContainer}>
                <Text style={styles.iconText}>📄</Text>
            </View>
            <View style={styles.downloadInfo}>
                <Text style={[styles.downloadName, { fontSize: sx(16) }]}>
                    {item.name}
                </Text>
                <Text style={[styles.downloadMeta, { fontSize: sx(12) }]}>
                    {item.size} • {item.date}
                </Text>
            </View>
            <TouchableOpacity style={styles.downloadButton}>
                <Text style={styles.downloadIcon}>⬇️</Text>
            </TouchableOpacity>
            </AppCard>
        </TouchableOpacity>
    );

    return (
        <Screenn bgColor="#fff" useDefaultBg={false}>
            <View style={styles.root}>
                <AppHeader
                    title={"\u0627\u0644\u062a\u0646\u0632\u064a\u0644\u0627\u062a"}
                    subtitle={"\u0645\u0644\u0641\u0627\u062a\u0643 \u0648\u0625\u064a\u0635\u0627\u0644\u0627\u062a\u0643 \u0627\u0644\u0645\u062d\u0645\u0644\u0629"}
                />

                {/* Downloads List */}
                {downloads.length > 0 ? (
                    <FlatList
                        data={downloads}
                        renderItem={renderDownloadItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{
                            paddingHorizontal: sx(spacing.lg),
                            paddingTop: sy(spacing.lg),
                            paddingBottom: sy(100),
                        }}
                        ItemSeparatorComponent={() => <View style={{ height: sy(spacing.md) }} />}
                    />
                ) : (
                    <AppEmptyState
                        icon="download-outline"
                        title={"\u0644\u0627 \u062a\u0648\u062c\u062f \u062a\u0646\u0632\u064a\u0644\u0627\u062a \u0628\u0639\u062f"}
                        subtitle={"\u0633\u062a\u0638\u0647\u0631 \u0645\u0644\u0641\u0627\u062a\u0643 \u0648\u0625\u064a\u0635\u0627\u0644\u0627\u062a\u0643 \u0627\u0644\u0645\u062d\u0645\u0644\u0629 \u0647\u0646\u0627 \u0644\u0627\u062d\u0642\u0627"}
                        style={styles.emptyState}
                    />
                )}
            </View>

            {/* Bottom Navigation */}
            <NavBar
                active="shipping"
                insetBottom={0}
                onPressHome={() => navigation.navigate("Home")}
                onPressMenu={() => navigation.navigate("Menu")}
                onPressShipping={() => navigation.navigate("PaymentMethodsList")}
                onPressQR={() => navigation.navigate("QRScanner")}
                onPressSend={() => { }}
            />
        </Screenn>
    );
}

const styles = StyleSheet.create({
    root: {
        backgroundColor: colors.surface.background,
        flex: 1,
    },
    downloadItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        ...shadows.soft,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: radius.pill,
        backgroundColor: colors.surface.cardSoft,
        borderColor: colors.border.default,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    iconText: {
        fontSize: 24,
    },
    downloadInfo: {
        flex: 1,
    },
    downloadName: {
        fontFamily: fontFamilies.bold,
        fontWeight: "700",
        color: colors.text.primary,
        lineHeight: typography.body.lineHeight,
        marginBottom: spacing.xs,
    },
    downloadMeta: {
        fontFamily: fontFamilies.regular,
        color: colors.text.muted,
        fontWeight: "500",
        lineHeight: typography.caption.lineHeight,
    },
    downloadButton: {
        width: 40,
        height: 40,
        borderRadius: radius.pill,
        backgroundColor: colors.brand.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    downloadIcon: {
        fontSize: 20,
    },
    emptyState: {
        marginHorizontal: spacing.lg,
        marginTop: spacing.xxl,
    },
});
