import Downloads from "../../src/screens/Downloads";
import { useNavigationShim } from "../../src/utils/navigation";

export default function DownloadsScreen() {
    const navigation = useNavigationShim();

    return <Downloads navigation={navigation} />;
}
