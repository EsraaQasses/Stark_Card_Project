import React, { useState, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    Animated,
    Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
const { width } = Dimensions.get("window");

const PAGES = [
    {
        id: "1",
        title: "مرحباً بك في Stark Card",
        desc: "محفظتك الإلكترونية المتكاملة لشراء البطاقات وخدمات الألعاب بكل سهولة وأمان.",
        icon: "wallet-outline",
        colors: ["#0B63D8", "#0047AB"],
    },
    {
        id: "2",
        title: "مدفوعات عالمية",
        desc: "احصل على بطاقات افتراضية عالمية وادفع في مئات المتاجر والخدمات حول العالم.",
        icon: "globe-outline",
        colors: ["#4F46E5", "#3730A3"],
    },
    {
        id: "3",
        title: "سرعة وأمان",
        desc: "عمليات شحن فورية وحماية متقدمة لبياناتك وأموالك في كل معاملة تقوم بها.",
        icon: "shield-checkmark-outline",
        colors: ["#10B981", "#059669"],
    },
    {
        id: "4",
        title: "شبكة وكلاء واسعة",
        desc: "بإمكانك شحن محفظتك بسهولة عبر شبكة وكلائنا المعتمدين في جميع المناطق.",
        icon: "people-outline",
        colors: ["#F59E0B", "#D97706"],
    },
    {
        id: "5",
        title: "جاهز للانطلاق؟",
        desc: "انضم الآن إلى آلاف المستخدمين وابدأ تجربتك الفريدة مع Stark Card اليوم!",
        icon: "rocket-outline",
        colors: ["#EF4444", "#B91C1C"],
    },
];

export default function OnboardingScreen() {
    const router = useRouter();
    const scrollX = useRef(new Animated.Value(0)).current;
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef(null);

    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        if (viewableItems[0]) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    const handleNext = async () => {
        if (currentIndex < PAGES.length - 1) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            flatListRef.current.scrollToIndex({ index: currentIndex + 1 });
        } else {
            await finishOnboarding();
        }
    };

    const finishOnboarding = async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await AsyncStorage.setItem("HAS_FINISHED_ONBOARDING", "true");
        router.replace("/(auth)/login");
    };

    const renderItem = ({ item }) => {
        return (
            <View style={styles.page}>
                <LinearGradient colors={item.colors} style={styles.iconCircle}>
                    <Ionicons name={item.icon} size={80} color="#FFF" />
                </LinearGradient>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.desc}>{item.desc}</Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <Pressable style={styles.skipBtn} onPress={finishOnboarding}>
                <Text style={styles.skipText}>تخطي</Text>
            </Pressable>

            <Animated.FlatList
                ref={flatListRef}
                data={PAGES}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false }
                )}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
                renderItem={renderItem}
            />

            <View style={styles.footer}>
                <View style={styles.indicatorContainer}>
                    {PAGES.map((_, i) => {
                        const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
                        const dotWidth = scrollX.interpolate({
                            inputRange,
                            outputRange: [10, 25, 10],
                            extrapolate: "clamp",
                        });
                        const opacity = scrollX.interpolate({
                            inputRange,
                            outputRange: [0.3, 1, 0.3],
                            extrapolate: "clamp",
                        });
                        return (
                            <Animated.View
                                key={i}
                                style={[styles.dot, { width: dotWidth, opacity }]}
                            />
                        );
                    })}
                </View>

                <Pressable onPress={handleNext} style={styles.nextBtn}>
                    <LinearGradient
                        colors={PAGES[currentIndex].colors}
                        style={styles.nextGradient}
                    >
                        <Text style={styles.nextText}>
                            {currentIndex === PAGES.length - 1 ? "ابدأ الآن" : "التالي"}
                        </Text>
                        <Ionicons name="arrow-back" size={20} color="#FFF" style={styles.arrowIcon} />
                    </LinearGradient>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFF",
    },
    skipBtn: {
        position: "absolute",
        top: 50,
        right: 30,
        zIndex: 10,
        padding: 10,
    },
    skipText: {
        fontSize: 16,
        color: "#666",
        fontWeight: "600",
    },
    page: {
        width,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 40,
    },
    iconCircle: {
        width: 180,
        height: 180,
        borderRadius: 90,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 50,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 10,
    },
    title: {
        fontSize: 28,
        fontWeight: "800",
        color: "#1A2138",
        textAlign: "center",
        marginBottom: 20,
    },
    desc: {
        fontSize: 16,
        lineHeight: 26,
        color: "#6B7B9A",
        textAlign: "center",
    },
    footer: {
        paddingHorizontal: 30,
        paddingBottom: 50,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    indicatorContainer: {
        flexDirection: "row",
        gap: 8,
    },
    dot: {
        height: 10,
        borderRadius: 5,
        backgroundColor: "#0B63D8",
    },
    nextBtn: {
        width: 140,
        height: 56,
    },
    nextGradient: {
        flex: 1,
        borderRadius: 28,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    nextText: {
        color: "#FFF",
        fontSize: 18,
        fontWeight: "bold",
    },
    arrowIcon: {
        transform: [{ rotate: "180deg" }],
    },
});
