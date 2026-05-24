export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Reject SQL queries on tenant-scoped tables without tenant_id predicate',
      category: 'Security',
    },
    schema: [],
  },
  create(context) {
    const TENANT_SCOPED_TABLES = [
      'workflows',
      'runs',
      'step_runs',
      'schedules',
      'webhooks',
      'logs',
      'audit_logs'
    ];

    function checkQuery(node, queryText) {
      const lowerQuery = queryText.toLowerCase();
      // Check if any tenant scoped table is mentioned in the query
      const referencesScopedTable = TENANT_SCOPED_TABLES.some(table => 
        new RegExp(`\\b${table}\\b`).test(lowerQuery)
      );

      if (referencesScopedTable) {
        // If it's a SELECT, UPDATE, or DELETE, check if it contains 'tenant_id'
        const isReadOrModify = /\b(select|update|delete)\b/.test(lowerQuery);
        if (isReadOrModify && !lowerQuery.includes('tenant_id')) {
          context.report({
            node,
            message: `SQL query on tenant-scoped table is missing 'tenant_id' predicate: "${queryText.trim().substring(0, 60)}..."`,
          });
        }
      }
    }

    return {
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'query'
        ) {
          const firstArg = node.arguments[0];
          if (!firstArg) return;

          if (firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
            checkQuery(node, firstArg.value);
          } else if (firstArg.type === 'TemplateLiteral') {
            // Get raw/quasis string parts
            const queryText = firstArg.quasis.map(q => q.value.raw).join('');
            checkQuery(node, queryText);
          }
        }
      }
    };
  }
};
