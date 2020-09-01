/**
 * This file is part of Graylog.
 *
 * Graylog is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Graylog is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Graylog.  If not, see <http://www.gnu.org/licenses/>.
 */
package org.graylog2.storage;

import org.graylog2.plugin.Version;

import javax.inject.Inject;
import javax.inject.Provider;
import java.util.Map;

public class VersionAwareProvider<T> implements Provider<T> {
    private final Version elasticsearchMajorVersion;
    private final Map<Version, Provider<T>> pluginBindings;

    @Inject
    public VersionAwareProvider(@ElasticsearchVersion Version elasticsearchMajorVersion, Map<Version, Provider<T>> pluginBindings) {
        this.elasticsearchMajorVersion = elasticsearchMajorVersion;
        this.pluginBindings = pluginBindings;
    }

    @Override
    public T get() {
        final Provider<T> provider = this.pluginBindings.get(elasticsearchMajorVersion);
        if (provider == null) {
            throw new IllegalStateException("Incomplete Elasticsearch implementation for version \"" + elasticsearchMajorVersion + "\".");
        }
        return provider.get();
    }
}
