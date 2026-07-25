// src/screens/MyOrders.js
import React from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
} from "react-native";
import Screenn from "../ui/Screenn";
import NavBar from "../ui/NavBar";
import Theme from "../ui/Theme";
import { useScale } from "../ui/scale";

const { colors } = Theme;

export default function MyOrders({ navigation }) {
    const { sx, sy } = useScale();
    const loading = false;

    // قائمة الطلبات - يمكن ربطها بـ API لاحقاً
    const orders = [
        {
            id: "1",
            orderNumber: "ORD-2024-001",
            date: "2024-12-09",
            status: "delivered",
            total: 150.0,
            items: 3,
        },
        {
            id: "2",
            orderNumber: "ORD-2024-002",
            date: "2024-12-08",
            status: "pending",
            total: 89.5,
            items: 2,
        },
        {
            id: "3",
            orderNumber: "ORD-2024-003",
            date: "2024-12-07",
            status: "processing",
            total: 220.0,
            items: 5,
        },
    ];

    const getStatusColor = (status) => {
        switch (status) {
            case "delivered":
                return "#10B981";
            case "processing":
                return "#F59E0B";
            case "pending":
                return "#6B7280";
            case "cancelled":
                return "#EF4444";
            default:
                return "#6B7280";
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case "delivered":
                return "Delivered";
            case "processing":
                return "Processing";
            case "pending":
                return "Pending";
            case "cancelled":
                return "Cancelled";
            default:
                return status;
        }
    };

    const renderOrderItem = ({ item }) => (
        <TouchableOpacity
            style={[styles.orderItem, { borderRadius: sx(12) }]}
            onPress={() => {
                // Navigate to order details
                // navigation.navigate("OrderDetail", { orderId: item.id });
            }}
        >
            <View style={styles.orderHeader}>
                <Text style={[styles.orderNumber, { fontSize: sx(16) }]}>
                    {item.orderNumber}
                </Text>
                <View
                    style={[
                        styles.statusBadge,
                        {
                            backgroundColor: getStatusColor(item.status) + "20",
                            borderRadius: sx(8),
                        },
                    ]}
                >
                    <Text
                        style={[
                            styles.statusText,
                            { color: getStatusColor(item.status), fontSize: sx(12) },
                        ]}
                    >
                        {getStatusText(item.status)}
                    </Text>
                </View>
            </View>

            <View style={styles.orderDetails}>
                <Text style={[styles.orderDate, { fontSize: sx(13) }]}>
                    📅 {item.date}
                </Text>
                <Text style={[styles.orderItems, { fontSize: sx(13) }]}>
                    📦 {item.items} items
                </Text>
            </View>

            <View style={styles.orderFooter}>
                <Text style={[styles.orderTotal, { fontSize: sx(18) }]}>
                    ${item.total.toFixed(2)}
                </Text>
                <Text style={[styles.viewDetails, { fontSize: sx(13) }]}>
                    View Details →
                </Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <Screenn bgColor="#fff" useDefaultBg={false}>
            <View style={{ flex: 1, paddingTop: sy(36) }}>
                {/* Header */}
                <View style={{ paddingHorizontal: sx(14), marginBottom: sy(20) }}>
                    <Text style={[styles.title, { fontSize: sx(28) }]}>My Orders</Text>
                    <Text style={[styles.subtitle, { fontSize: sx(14) }]}>
                        Track and manage your orders
                    </Text>
                </View>

                {/* Orders List */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#0B63D8" />
                    </View>
                ) : orders.length > 0 ? (
                    <FlatList
                        data={orders}
                        renderItem={renderOrderItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{
                            paddingHorizontal: sx(14),
                            paddingBottom: sy(100),
                        }}
                        ItemSeparatorComponent={() => <View style={{ height: sy(12) }} />}
                    />
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={[styles.emptyIcon, { fontSize: sx(64) }]}>📦</Text>
                        <Text style={[styles.emptyText, { fontSize: sx(18) }]}>
                            No orders yet
                        </Text>
                        <Text style={[styles.emptySubtext, { fontSize: sx(14) }]}>
                            Start shopping to see your orders here
                        </Text>
                        <TouchableOpacity
                            style={[
                                styles.shopButton,
                                { borderRadius: sx(12), marginTop: sy(20) },
                            ]}
                            onPress={() => navigation.navigate("Products")}
                        >
                            <Text style={[styles.shopButtonText, { fontSize: sx(16) }]}>
                                Browse Products
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Bottom Navigation */}
            <NavBar
                active="menu"
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
    title: {
        fontWeight: "800",
        color: "#0E1B3B",
        marginBottom: 4,
    },
    subtitle: {
        color: "#7C8DA6",
        fontWeight: "500",
    },
    loadingContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    orderItem: {
        backgroundColor: "#F8FAFC",
        padding: 16,
        borderWidth: 1,
        borderColor: colors.line,
    },
    orderHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    orderNumber: {
        fontWeight: "700",
        color: "#0E1B3B",
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    statusText: {
        fontWeight: "600",
    },
    orderDetails: {
        flexDirection: "row",
        gap: 16,
        marginBottom: 12,
    },
    orderDate: {
        color: "#7C8DA6",
        fontWeight: "500",
    },
    orderItems: {
        color: "#7C8DA6",
        fontWeight: "500",
    },
    orderFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.line,
    },
    orderTotal: {
        fontWeight: "800",
        color: "#0B63D8",
    },
    viewDetails: {
        color: "#0B63D8",
        fontWeight: "600",
    },
    emptyState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
    },
    emptyIcon: {
        marginBottom: 16,
    },
    emptyText: {
        fontWeight: "700",
        color: "#0E1B3B",
        marginBottom: 8,
    },
    emptySubtext: {
        color: "#7C8DA6",
        textAlign: "center",
    },
    shopButton: {
        backgroundColor: "#0B63D8",
        paddingVertical: 14,
        paddingHorizontal: 32,
    },
    shopButtonText: {
        color: "#FFFFFF",
        fontWeight: "700",
    },
});
