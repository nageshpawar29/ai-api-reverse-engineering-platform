import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseModel, ModelField, ModelIndex, ModelRelationship } from '../../types/index.js';

export class DatabaseAnalyzer {
  public static async extractModels(
    projectDir: string,
    projectId: string,
    allFiles: string[]
  ): Promise<DatabaseModel[]> {
    const models: DatabaseModel[] = [];

    // 1. Check for Prisma schema anywhere in the repository
    const prismaSchemaPath = this.findPrismaSchema(projectDir);
    if (prismaSchemaPath && fs.existsSync(prismaSchemaPath)) {
      const prismaModels = this.parsePrismaSchema(prismaSchemaPath, projectDir, projectId);
      models.push(...prismaModels);
    }

    // 2. Check for Mongoose / TypeORM / Sequelize models in source files
    const codeModels = this.parseCodeModels(projectDir, projectId, allFiles);
    for (const cm of codeModels) {
      if (!models.some((m) => m.name.toLowerCase() === cm.name.toLowerCase())) {
        models.push(cm);
      }
    }

    // 3. Check for SQL files (migrations, ddl, schema.sql)
    const sqlModels = this.parseSqlFiles(projectDir, projectId, allFiles);
    for (const sm of sqlModels) {
      if (!models.some((m) => m.name.toLowerCase() === sm.name.toLowerCase())) {
        models.push(sm);
      }
    }

    return models;
  }

  private static findPrismaSchema(projectDir: string): string | null {
    const candidates = [
      path.join(projectDir, 'prisma', 'schema.prisma'),
      path.join(projectDir, 'schema.prisma'),
      path.join(projectDir, 'src', 'prisma', 'schema.prisma'),
      path.join(projectDir, 'server', 'prisma', 'schema.prisma'),
      path.join(projectDir, 'backend', 'prisma', 'schema.prisma'),
      path.join(projectDir, 'packages', 'db', 'prisma', 'schema.prisma'),
      path.join(projectDir, 'packages', 'database', 'prisma', 'schema.prisma'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }

    // Recursive search for any *.prisma file
    const found: string[] = [];
    const walk = (dir: string, depth = 0) => {
      if (depth > 5 || found.length > 0 || !fs.existsSync(dir)) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          if (found.length > 0) return;
          const full = path.join(dir, e.name);
          if (e.isDirectory()) {
            if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(e.name)) {
              walk(full, depth + 1);
            }
          } else if (e.name.endsWith('.prisma')) {
            found.push(full);
            return;
          }
        }
      } catch (err) {}
    };
    walk(projectDir);
    return found.length > 0 ? found[0] : null;
  }

  private static parseSqlFiles(
    projectDir: string,
    projectId: string,
    allFiles: string[]
  ): DatabaseModel[] {
    const models: DatabaseModel[] = [];
    const sqlFiles = allFiles.filter((f) => f.endsWith('.sql'));

    for (const filePath of sqlFiles) {
      try {
        const sql = fs.readFileSync(filePath, 'utf-8');
        const relPath = path.relative(projectDir, filePath);
        const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([a-zA-Z0-9_]+)["`]?\s*\(([\s\S]*?)\);/gi;
        let match;

        while ((match = tableRegex.exec(sql)) !== null) {
          const tableName = match[1];
          const body = match[2];
          const fields: ModelField[] = [];

          const colLines = body.split(',\n');
          for (const line of colLines) {
            const trimmed = line.trim();
            if (
              !trimmed ||
              trimmed.startsWith('PRIMARY KEY') ||
              trimmed.startsWith('FOREIGN KEY') ||
              trimmed.startsWith('CONSTRAINT') ||
              trimmed.startsWith('INDEX') ||
              trimmed.startsWith('UNIQUE')
            ) {
              continue;
            }

            const colMatch = trimmed.match(/^["`]?([a-zA-Z0-9_]+)["`]?\s+([A-Za-z0-9_()]+)/);
            if (colMatch) {
              const colName = colMatch[1];
              const colType = colMatch[2];
              const isPrimary = trimmed.toUpperCase().includes('PRIMARY KEY') || colName.toLowerCase() === 'id';
              const isUnique = trimmed.toUpperCase().includes('UNIQUE') || isPrimary;
              const isNullable = !trimmed.toUpperCase().includes('NOT NULL');

              fields.push({
                id: `field-${uuidv4().substring(0, 8)}`,
                modelId: '',
                name: colName,
                fieldType: colType.toLowerCase(),
                isPrimaryKey: isPrimary,
                isNullable,
                isUnique,
                isIndexed: isPrimary || isUnique || colName.endsWith('_id'),
                foreignKeyTarget: colName.endsWith('_id') ? colName.replace(/_id$/, '') : undefined,
              });
            }
          }

          if (fields.length > 0 && !models.some((m) => m.name.toLowerCase() === tableName.toLowerCase())) {
            models.push({
              id: `model-${uuidv4().substring(0, 8)}`,
              projectId,
              name: tableName,
              tableName,
              ormType: 'sql',
              sourceFile: relPath,
              description: `Relational SQL Table: ${tableName}`,
              detectionType: 'DETECTED',
              domain: this.assignDomain(tableName),
              fields,
              createdAt: new Date().toISOString(),
            });
          }
        }
      } catch (e) {}
    }

    return models;
  }

  private static assignDomain(
    name: string
  ): 'Identity & Security' | 'Commerce & Products' | 'Orders & Fulfillment' | 'Financial & Ledger' | 'Audit & Compliance' | 'AI & Vector Search' | 'General' {
    const lower = name.toLowerCase();
    if (
      lower.includes('user') ||
      lower.includes('tenant') ||
      lower.includes('auth') ||
      lower.includes('key') ||
      lower.includes('session') ||
      lower.includes('account') ||
      lower.includes('role') ||
      lower.includes('permission')
    ) {
      return 'Identity & Security';
    }
    if (
      lower.includes('product') ||
      lower.includes('category') ||
      lower.includes('item') ||
      lower.includes('catalog') ||
      lower.includes('inventory') ||
      lower.includes('stock')
    ) {
      return 'Commerce & Products';
    }
    if (
      lower.includes('order') ||
      lower.includes('cart') ||
      lower.includes('fulfillment') ||
      lower.includes('shipping') ||
      lower.includes('delivery')
    ) {
      return 'Orders & Fulfillment';
    }
    if (
      lower.includes('payment') ||
      lower.includes('invoice') ||
      lower.includes('billing') ||
      lower.includes('transaction') ||
      lower.includes('ledger') ||
      lower.includes('refund')
    ) {
      return 'Financial & Ledger';
    }
    if (
      lower.includes('audit') ||
      lower.includes('log') ||
      lower.includes('webhook') ||
      lower.includes('event') ||
      lower.includes('metric') ||
      lower.includes('compliance')
    ) {
      return 'Audit & Compliance';
    }
    if (
      lower.includes('vector') ||
      lower.includes('embedding') ||
      lower.includes('ai') ||
      lower.includes('knowledge') ||
      lower.includes('semantic') ||
      lower.includes('rag')
    ) {
      return 'AI & Vector Search';
    }
    return 'General';
  }

  private static parsePrismaSchema(
    schemaPath: string,
    projectDir: string,
    projectId: string
  ): DatabaseModel[] {
    const models: DatabaseModel[] = [];
    try {
      const content = fs.readFileSync(schemaPath, 'utf-8');
      const lines = content.split('\n');

      let currentModel: DatabaseModel | null = null;
      const relativeSource = path.relative(projectDir, schemaPath);

      // Temporary map to track raw relation statements for cross-linking
      const pendingRelations: Array<{
        modelName: string;
        fieldName: string;
        targetModel: string;
        foreignKeyField?: string;
        targetField?: string;
        onDelete?: string;
        isArray: boolean;
      }> = [];

      for (let line of lines) {
        line = line.trim();

        // Model start: model User {
        const modelMatch = line.match(/^model\s+([A-Za-z0-9_]+)\s*\{/);
        if (modelMatch) {
          const modelName = modelMatch[1];
          currentModel = {
            id: `model-${uuidv4().substring(0, 8)}`,
            projectId,
            name: modelName,
            tableName: modelName.toLowerCase() + 's',
            ormType: 'prisma',
            sourceFile: relativeSource,
            description: `Prisma Database Entity: ${modelName}`,
            detectionType: 'DETECTED',
            domain: this.assignDomain(modelName),
            fields: [],
            indexes: [],
            relationships: [],
            createdAt: new Date().toISOString(),
          };
          continue;
        }

        // Model end
        if (line.startsWith('}') && currentModel) {
          models.push(currentModel);
          currentModel = null;
          continue;
        }

        if (!currentModel) continue;

        // Composite Indexes: @@index([tenantId, status])
        const indexMatch = line.match(/^@@index\(\[([^\]]+)\]\)/);
        if (indexMatch) {
          const fields = indexMatch[1].split(',').map((f) => f.trim());
          currentModel.indexes?.push({
            fields,
            isUnique: false,
            name: `idx_${currentModel.name.toLowerCase()}_${fields.join('_')}`,
            type: 'BTREE',
          });
          // Mark fields as indexed
          fields.forEach((fName) => {
            const f = currentModel?.fields.find((field) => field.name === fName);
            if (f) f.isIndexed = true;
          });
          continue;
        }

        // Composite Unique: @@unique([tenantId, email])
        const uniqueMatch = line.match(/^@@unique\(\[([^\]]+)\]\)/);
        if (uniqueMatch) {
          const fields = uniqueMatch[1].split(',').map((f) => f.trim());
          currentModel.indexes?.push({
            fields,
            isUnique: true,
            name: `uniq_${currentModel.name.toLowerCase()}_${fields.join('_')}`,
            type: 'BTREE',
          });
          continue;
        }

        // Composite Primary Key: @@id([orderId, productId])
        const idMatch = line.match(/^@@id\(\[([^\]]+)\]\)/);
        if (idMatch) {
          const fields = idMatch[1].split(',').map((f) => f.trim());
          fields.forEach((fName) => {
            const f = currentModel?.fields.find((field) => field.name === fName);
            if (f) f.isPrimaryKey = true;
          });
          continue;
        }

        // Field line
        if (line && !line.startsWith('//') && !line.startsWith('@@')) {
          const parts = line.split(/\s+/);
          if (parts.length >= 2) {
            const fieldName = parts[0];
            const rawType = parts[1];
            const cleanType = rawType.replace('?', '').replace('[]', '');
            const isArray = rawType.endsWith('[]');
            const isNullable = rawType.includes('?');

            // Scalar vs Relation detection
            const isScalar = [
              'String',
              'Int',
              'Float',
              'Boolean',
              'DateTime',
              'Json',
              'Decimal',
              'Bytes',
              'BigInt',
            ].includes(cleanType);

            // Relation definition line e.g. user User @relation(fields: [userId], references: [id], onDelete: Cascade)
            if (!isScalar) {
              const relationMatch = line.match(/@relation\([^)]*\)/);
              let fkField: string | undefined = undefined;
              let refField: string | undefined = 'id';
              let onDeleteAction: string | undefined = undefined;

              if (relationMatch) {
                const relText = relationMatch[0];
                const fieldsM = relText.match(/fields:\s*\[([^\]]+)\]/);
                const refM = relText.match(/references:\s*\[([^\]]+)\]/);
                const delM = relText.match(/onDelete:\s*([A-Za-z0-9_]+)/);

                if (fieldsM) fkField = fieldsM[1].trim();
                if (refM) refField = refM[1].trim();
                if (delM) onDeleteAction = delM[1].trim();
              }

              pendingRelations.push({
                modelName: currentModel.name,
                fieldName,
                targetModel: cleanType,
                foreignKeyField: fkField,
                targetField: refField,
                onDelete: onDeleteAction,
                isArray,
              });

              // If this is a foreign-key pointing relation and specifies fields: [userId],
              // we tag the scalar field in this model as a foreign key!
              if (fkField) {
                const targetScalarField = currentModel.fields.find((f) => f.name === fkField);
                if (targetScalarField) {
                  targetScalarField.foreignKeyTarget = cleanType;
                  targetScalarField.foreignKeyField = refField;
                  if (onDeleteAction) {
                    targetScalarField.constraints = targetScalarField.constraints || [];
                    targetScalarField.constraints.push(`ON DELETE ${onDeleteAction.toUpperCase()}`);
                  }
                }
              }

              // Do not add the virtual navigation property as a database column
              continue;
            }

            // Normal scalar field
            const isPrimaryKey = line.includes('@id');
            const isUnique = line.includes('@unique');
            const isIndexed = line.includes('@index') || isPrimaryKey || isUnique;

            // Extract default value
            let defaultValue: string | undefined = undefined;
            const defaultMatch = line.match(/@default\(([^)]+)\)/);
            if (defaultMatch) {
              defaultValue = defaultMatch[1].replace(/"/g, '');
            }

            // Constraints
            const constraints: string[] = [];
            if (isPrimaryKey) constraints.push('PRIMARY KEY');
            if (isUnique) constraints.push('UNIQUE');
            if (line.includes('@updatedAt')) constraints.push('ON UPDATE CURRENT_TIMESTAMP');
            if (defaultValue) constraints.push(`DEFAULT ${defaultValue}`);

            currentModel.fields.push({
              id: `field-${uuidv4().substring(0, 8)}`,
              modelId: currentModel.id,
              name: fieldName,
              fieldType: cleanType,
              isPrimaryKey,
              isNullable,
              isUnique,
              isIndexed,
              defaultValue,
              constraints,
            });
          }
        }
      }

      // Link pending relations to build bidirectional ModelRelationship structures
      models.forEach((source) => {
        const sourceRels = pendingRelations.filter((r) => r.modelName === source.name);
        sourceRels.forEach((rel) => {
          const target = models.find(
            (m) => m.name.toLowerCase() === rel.targetModel.toLowerCase()
          );
          if (target) {
            // Find inverse relation in target
            const inverse = pendingRelations.find(
              (r) => r.modelName === target.name && r.targetModel === source.name
            );

            let cardinality: '1:1' | '1:N' | 'N:M' | 'N:1' = 'N:1';
            if (rel.isArray && (!inverse || !inverse.isArray)) {
              cardinality = '1:N';
            } else if (!rel.isArray && inverse && inverse.isArray) {
              cardinality = 'N:1';
            } else if (rel.isArray && inverse && inverse.isArray) {
              cardinality = 'N:M';
            } else {
              cardinality = '1:1';
            }

            // If foreignKeyField was defined in relation, update scalar column
            if (rel.foreignKeyField) {
              const scalarCol = source.fields.find((f) => f.name === rel.foreignKeyField);
              if (scalarCol) {
                scalarCol.foreignKeyTarget = target.name;
                scalarCol.foreignKeyField = rel.targetField || 'id';
              }
            }

            // Push to model relationships
            const relId = `rel-${source.name}-${target.name}-${rel.fieldName}`;
            if (!source.relationships?.some((r) => r.id === relId)) {
              source.relationships?.push({
                id: relId,
                sourceModel: source.name,
                sourceField: rel.foreignKeyField || rel.fieldName,
                targetModel: target.name,
                targetField: rel.targetField || 'id',
                cardinality,
                onDelete: rel.onDelete,
                label: `${source.name}.${rel.fieldName} → ${target.name}`,
              });
            }
          }
        });
      });
    } catch (err) {
      console.warn('Error parsing Prisma schema:', err);
    }

    return models;
  }

  private static parseCodeModels(
    projectDir: string,
    projectId: string,
    allFiles: string[]
  ): DatabaseModel[] {
    const models: DatabaseModel[] = [];

    for (const filePath of allFiles) {
      const relPath = path.relative(projectDir, filePath);
      if (
        !relPath.toLowerCase().includes('model') &&
        !relPath.toLowerCase().includes('schema') &&
        !relPath.toLowerCase().includes('entities')
      ) {
        continue;
      }

      try {
        const code = fs.readFileSync(filePath, 'utf-8');

        // 1. Mongoose pattern: new Schema({ ... })
        if (code.includes('new Schema') || code.includes('new mongoose.Schema')) {
          const modelName = path.basename(filePath, path.extname(filePath));
          const fields: ModelField[] = [];
          const relationships: ModelRelationship[] = [];

          // Regex extract properties: title: { type: String, required: true, ref: 'User' }
          const propMatches = code.matchAll(/([a-zA-Z0-9_]+)\s*:\s*\{([^}]+)\}/g);
          for (const match of propMatches) {
            const fieldName = match[1];
            const body = match[2];
            const typeMatch = body.match(/type\s*:\s*([A-Za-z0-9_.]+)/);
            const refMatch = body.match(/ref\s*:\s*['"]([A-Za-z0-9_]+)['"]/);
            const fieldType = typeMatch ? typeMatch[1].replace('Schema.Types.', '') : 'string';
            const isRequired = body.includes('required: true');
            const isUnique = body.includes('unique: true');
            const isPrimary = fieldName === '_id' || fieldName === 'id';

            let foreignKeyTarget: string | undefined = undefined;
            if (refMatch) {
              foreignKeyTarget = refMatch[1];
              relationships.push({
                id: `rel-${modelName}-${foreignKeyTarget}`,
                sourceModel: modelName,
                sourceField: fieldName,
                targetModel: foreignKeyTarget,
                targetField: '_id',
                cardinality: 'N:1',
              });
            }

            fields.push({
              id: `field-${uuidv4().substring(0, 8)}`,
              modelId: '',
              name: fieldName,
              fieldType,
              isPrimaryKey: isPrimary,
              isNullable: !isRequired,
              isUnique,
              isIndexed: isPrimary || isUnique || Boolean(refMatch),
              foreignKeyTarget,
            });
          }

          if (fields.length > 0) {
            models.push({
              id: `model-${uuidv4().substring(0, 8)}`,
              projectId,
              name: modelName,
              tableName: modelName.toLowerCase() + 's',
              ormType: 'mongoose',
              sourceFile: relPath,
              description: `Mongoose Document Model: ${modelName}`,
              detectionType: 'DETECTED',
              domain: this.assignDomain(modelName),
              fields,
              relationships,
              createdAt: new Date().toISOString(),
            });
          }
        }

        // 2. TypeORM pattern: @Entity()
        if (code.includes('@Entity') || code.includes('@Column')) {
          const classMatch = code.match(/class\s+([A-Za-z0-9_]+)/);
          if (classMatch) {
            const modelName = classMatch[1];
            const fields: ModelField[] = [];

            const colMatches = code.matchAll(
              /@Column\([^)]*\)\s*\n*\s*([a-zA-Z0-9_]+)\s*[:?]\s*([A-Za-z0-9_]+)/g
            );
            for (const col of colMatches) {
              const fieldName = col[1];
              const fieldType = col[2];
              fields.push({
                id: `field-${uuidv4().substring(0, 8)}`,
                modelId: '',
                name: fieldName,
                fieldType,
                isPrimaryKey: false,
                isNullable: true,
                isUnique: false,
              });
            }

            // Primary column
            const primaryMatch = code.match(
              /@PrimaryGeneratedColumn\([^)]*\)\s*\n*\s*([a-zA-Z0-9_]+)\s*[:?]\s*([A-Za-z0-9_]+)/
            );
            if (primaryMatch) {
              fields.unshift({
                id: `field-pk-${uuidv4().substring(0, 6)}`,
                modelId: '',
                name: primaryMatch[1],
                fieldType: primaryMatch[2],
                isPrimaryKey: true,
                isNullable: false,
                isUnique: true,
                isIndexed: true,
              });
            }

            if (fields.length > 0) {
              models.push({
                id: `model-${uuidv4().substring(0, 8)}`,
                projectId,
                name: modelName,
                tableName: modelName.toLowerCase() + 's',
                ormType: 'typeorm',
                sourceFile: relPath,
                description: `TypeORM Entity: ${modelName}`,
                detectionType: 'DETECTED',
                domain: this.assignDomain(modelName),
                fields,
                createdAt: new Date().toISOString(),
              });
            }
          }
        }
      } catch (err) {}
    }

    return models;
  }
}
