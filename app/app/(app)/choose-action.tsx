import ChooseAction from "../../src/screens/ChooseAction";
import { useLocalSearchParams } from "expo-router";
import { useNavigationShim } from "../../src/utils/navigation";

export default function ChooseActionScreen() {
    const params = useLocalSearchParams();
    const navigation = useNavigationShim();

    const route = {
        params: params || {},
    };

    return <ChooseAction route={route} navigation={navigation} />;
}
