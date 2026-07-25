// Pure requirement helpers extracted from Payment.js.
// Preserves existing product/external requirement normalization and payload shape.
function inferFieldType(fieldName) {
  const nameLower = String(fieldName || "").toLowerCase();
  if (nameLower.includes("phone") || nameLower.includes("mobile") || nameLower.includes("tel")) return "phone";
  if (nameLower.includes("email") || nameLower.includes("mail")) return "email";
  if (nameLower.includes("id") || nameLower.includes("player") || nameLower.includes("user")) return "id";
  if (nameLower.includes("number") || nameLower.includes("amount") || nameLower.includes("qty")) return "number";
  return "text";
}

function defaultPlaceholder(fieldType, fieldName) {
  if (fieldType === "phone") return "مثال: 0991234567";
  if (fieldType === "email") return "example@email.com";
  if (fieldType === "id") return "أدخل المعرف";
  if (fieldType === "number") return "أدخل الرقم";
  return `أدخل ${fieldName}`;
}

function normalizeRequirementField(field, index) {
  if (typeof field === "string") {
    const fieldName = field.trim();
    const field_type = inferFieldType(fieldName);

    return {
      id: `ext_${index}`,
      field_name: fieldName,
      payload_key: fieldName,
      field_type,
      is_required: true,
      placeholder: defaultPlaceholder(field_type, fieldName),
    };
  }

  const typeRaw = (field.field_type || field.type || "").toString().toLowerCase();
  let field_type = "text";
  if (["number", "int", "integer"].includes(typeRaw)) field_type = "number";
  else if (["email"].includes(typeRaw)) field_type = "email";
  else if (["phone", "mobile", "tel"].includes(typeRaw)) field_type = "phone";
  else if (["id", "playerid", "user_id", "uid"].includes(typeRaw)) field_type = "id";
  else field_type = inferFieldType(field.field_name || field.name || "");

  const payload_key =
    field.key || field.field || field.code || field.name || field.field_name || field.label || field.id || `field_${index + 1}`;
  const field_name =
    field.field_name || field.name || field.label || field.key || field.field || field.code || field.id || `field_${index + 1}`;
  const is_required = field.is_required !== false && field.required !== false;

  let placeholder = field.placeholder || field.example || field.hint || field.label || "";
  if (!placeholder) placeholder = defaultPlaceholder(field_type, field_name);

  return {
    id: field.id ?? `ext_${index}`,
    field_name,
    payload_key,
    field_type,
    is_required,
    placeholder,
  };
}

export function normalizeProductRequirements(product) {
  let raw = [];

  if (Array.isArray(product?.requirements)) raw = product.requirements;
  else if (Array.isArray(product?._raw?.requirements)) raw = product._raw.requirements;

  if ((!raw || !raw.length) && product?.requirements && !Array.isArray(product.requirements)) {
    const requirementsObject = product.requirements;
    if (requirementsObject && typeof requirementsObject === "object") {
      raw = Object.entries(requirementsObject).map(([key, value], index) => ({
        ...(typeof value === "object" && value !== null ? value : {}),
        field_name: value?.field_name || value?.name || key,
        id: value?.id ?? `req_${index}`,
      }));
    }
  }

  const extSources = [];
  const ext1 = product?.external_product_info;
  const ext2 = product?.external_product;
  const extRaw = product?._raw?.external_product_info || product?._raw?.external_product;

  [ext1, ext2, extRaw].forEach((externalSource) => {
    if (!externalSource) return;

    if (Array.isArray(externalSource.required_fields)) extSources.push(...externalSource.required_fields);
    if (Array.isArray(externalSource.requirements)) extSources.push(...externalSource.requirements);

    if (
      !Array.isArray(externalSource.required_fields) &&
      externalSource.required_fields &&
      typeof externalSource.required_fields === "object"
    ) {
      const values = Object.values(externalSource.required_fields);
      if (values.length > 0) extSources.push(...values);
      else extSources.push(externalSource.required_fields);
    }
  });

  if (extSources.length > 0) {
    if (raw && raw.length > 0) {
      const existingNames = new Set(
        raw.map((requirement) =>
          typeof requirement === "string"
            ? requirement
            : requirement.field_name || requirement.name || requirement.key || ""
        )
      );

      const newFields = extSources.filter((field) => {
        const name = typeof field === "string" ? field : field.field_name || field.name || field.key || "";
        return name && !existingNames.has(name);
      });

      raw = [...raw, ...newFields];
    } else {
      raw = extSources;
    }
  }

  if (Array.isArray(raw)) return raw.map(normalizeRequirementField);
  return [];
}

export function buildRequirementPayload(requirements, requirementValues) {
  const values = {};
  const labels = {};

  if (requirements?.length) {
    requirements.forEach((requirement) => {
      const key = requirement.payload_key || requirement.field_name;
      const raw = requirementValues[key];
      if (key && raw != null && String(raw).trim() !== "") {
        values[key] = String(raw).trim();
        labels[key] = requirement.field_name;
      }
    });
  }

  return { values, _labels: labels };
}

export function findMissingRequiredRequirements(requirements, requirementValues) {
  if (!requirements?.length) return [];
  return requirements.filter((requirement) => {
    const key = requirement.payload_key || requirement.field_name;
    return requirement.is_required && !String(requirementValues[key] ?? "").trim();
  });
}
